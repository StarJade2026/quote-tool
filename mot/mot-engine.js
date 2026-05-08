/**
 * MOT时间引擎 v0.2
 * 核心逻辑：节点链匹配 → 工作日推算 → 风险分级判断
 * 基于道瑞SOP出口FCL + 进口FCL标准节点链
 */

var motEngine = (function() {
  'use strict';

  // ========== 工作日计算工具 ==========
  function isWeekend(d) {
    var day = d.getDay();
    return day === 0 || day === 6;
  }

  function addWorkdays(baseDate, workdays) {
    var d = new Date(baseDate);
    var added = 0;
    var direction = workdays >= 0 ? 1 : -1;
    workdays = Math.abs(workdays);
    while (added < workdays) {
      d.setDate(d.getDate() + direction);
      if (!isWeekend(d)) added++;
    }
    return d;
  }

  function workdaysBetween(d1, d2) {
    var count = 0;
    var cur = new Date(d1);
    var end = new Date(d2);
    var direction = d1 <= d2 ? 1 : -1;
    if (direction === -1) { var tmp = cur; cur = end; end = tmp; }
    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      if (!isWeekend(cur)) count++;
    }
    return count * direction;
  }

  function parseDate(str) {
    if (!str) return null;
    var parts = str.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  }

  function formatDate(d) {
    return d.getFullYear() + '-' + 
      String(d.getMonth()+1).padStart(2,'0') + '-' + 
      String(d.getDate()).padStart(2,'0');
  }

  // ========== 节点链定义 ==========
  var EXPORT_FCL_CHAIN = [
    { id: 'booking',       name: '订舱',        offsetFromETD: -10, stdWindow: 'ETD前14-7个工作日',  tolerance: 3, severityThreshold: 5 },
    { id: 'stuffing',      name: '装箱',        offsetFromETD: -4,  stdWindow: 'ETD前7-3个工作日',   tolerance: 2, severityThreshold: 4 },
    { id: 'customs',       name: '报关',        offsetFromETD: -2,  stdWindow: 'ETD前3-1个工作日',   tolerance: 1, severityThreshold: 2 },
    { id: 'departure',     name: '发运/开船',   offsetFromETD: 0,   stdWindow: 'ETD当天',            tolerance: 0, severityThreshold: 1 },
    { id: 'atSea',         name: '海上运输',     offsetFromETD: 1,   stdWindow: 'ETD+1至ETA前',      tolerance: 5, severityThreshold: 7 },
    { id: 'arrival',       name: '到港',        offsetFromETA: 0,   stdWindow: 'ETA当天',            tolerance: 1, severityThreshold: 2 },
    { id: 'arrivalNotice', name: '到港通知',     offsetFromETA: 1,   stdWindow: '到港后1-2个工作日',  tolerance: 1, severityThreshold: 2 }
  ];

  var IMPORT_FCL_CHAIN = [
    { id: 'arrival',       name: '到港',        offsetFromETA: 0,   stdWindow: 'ETA当天',            tolerance: 1, severityThreshold: 2 },
    { id: 'exchangeBL',    name: '换单',        offsetFromETA: 1,   stdWindow: '到港后1-2个工作日',  tolerance: 1, severityThreshold: 2 },
    { id: 'customsClear',  name: '清关',        offsetFromETA: 3,   stdWindow: '到港后2-4个工作日',  tolerance: 2, severityThreshold: 3 },
    { id: 'pickup',        name: '提货',        offsetFromETA: 5,   stdWindow: '到港后4-6个工作日',  tolerance: 2, severityThreshold: 3 },
    { id: 'delivery',      name: '派送',        offsetFromETA: 6,   stdWindow: '到港后5-7个工作日',  tolerance: 2, severityThreshold: 3 }
  ];

  // ========== 主分析函数 ==========
  function analyze(wfData) {
    // 判断运输模式，选节点链
    var mode = (wfData.mode || '').toUpperCase();
    var isImport = mode.indexOf('进口') !== -1 || mode.indexOf('IMPORT') !== -1;
    var chain = isImport ? IMPORT_FCL_CHAIN : EXPORT_FCL_CHAIN;

    var etd = parseDate(wfData.etd);
    var eta = parseDate(wfData.eta);
    
    if (!etd && !eta) {
      throw new Error('至少需要ETD或ETA中的一个，才能进行时间分析');
    }

    var actualDates = {};
    if (wfData.actualDates) {
      Object.keys(wfData.actualDates).forEach(function(k) {
        actualDates[k] = parseDate(wfData.actualDates[k]);
      });
    }

    // 推算每个节点的标准时间（用工作日）
    var nodes = chain.map(function(nodeDef) {
      var expectedDate;
      if (nodeDef.offsetFromETD !== undefined && etd) {
        expectedDate = addWorkdays(etd, nodeDef.offsetFromETD);
      } else if (nodeDef.offsetFromETA !== undefined && eta) {
        expectedDate = addWorkdays(eta, nodeDef.offsetFromETA);
      } else {
        expectedDate = null;
      }

      var actualDate = actualDates[nodeDef.id] || null;
      var diffWorkdays = null;
      var severity = 'normal';

      if (actualDate && expectedDate) {
        diffWorkdays = workdaysBetween(expectedDate, actualDate);
        var absDiff = Math.abs(diffWorkdays);
        if (absDiff >= nodeDef.severityThreshold) {
          severity = 'critical';
        } else if (absDiff > nodeDef.tolerance) {
          severity = 'warning';
        }
      }

      return {
        id: nodeDef.id,
        name: nodeDef.name,
        expectedDate: expectedDate ? formatDate(expectedDate) : 'N/A',
        actualDate: actualDate ? formatDate(actualDate) : null,
        stdWindow: nodeDef.stdWindow,
        diffWorkdays: diffWorkdays,
        severity: severity
      };
    });

    // 生成风险提示
    var risks = [];
    nodes.forEach(function(n) {
      if (n.severity === 'critical') {
        risks.push({
          level: 'high',
          nodeName: n.name,
          message: '🔴 严重延迟：实际' + n.actualDate + '，偏离标准' + n.expectedDate + '约' + Math.abs(n.diffWorkdays) + '个工作日，可能影响后续全部节点'
        });
      } else if (n.severity === 'warning') {
        risks.push({
          level: 'mid',
          nodeName: n.name,
          message: '🟡 轻微偏差：实际' + n.actualDate + '，偏离标准' + n.expectedDate + '约' + Math.abs(n.diffWorkdays) + '个工作日，请关注后续节点缓冲'
        });
      }
    });

    return {
      workflowInfo: {
        billNo: wfData.billNo || 'N/A',
        mode: wfData.mode || 'N/A',
        origin: wfData.origin || '',
        destination: wfData.destination || '',
        etd: wfData.etd || '',
        eta: wfData.eta || '',
        terms: wfData.terms || ''
      },
      nodes: nodes,
      risks: risks
    };
  }

  return { analyze: analyze };
})();
