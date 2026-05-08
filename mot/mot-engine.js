/**
 * MOT时间引擎 v0.1
 * 核心逻辑：节点链匹配 → 时间推算 → 风险判断
 * 基于道瑞SOP出口FCL标准节点链
 */

const motEngine = (function() {
  'use strict';

  // ========== 配置：出口FCL标准节点链 ==========
  // 时间偏移量（单位：天），以ETD（预计开船日）为锚点
  const EXPORT_FCL_CHAIN = [
    { id: 'booking',       name: '订舱',        offsetFromETD: -14, stdWindow: 'ETD前14-10天',   tolerance: 2 },
    { id: 'stuffing',      name: '装箱',        offsetFromETD: -5,  stdWindow: 'ETD前7-3天',     tolerance: 2 },
    { id: 'customs',       name: '报关',        offsetFromETD: -2,  stdWindow: 'ETD前3-1天',     tolerance: 1 },
    { id: 'departure',     name: '发运/开船',   offsetFromETD: 0,   stdWindow: 'ETD当天',         tolerance: 0 },
    { id: 'atSea',         name: '海上运输',     offsetFromETD: 1,   stdWindow: 'ETD+1至ETA-2',   tolerance: 3 },
    { id: 'arrival',       name: '到港',        offsetFromETA: 0,   stdWindow: 'ETA当天',         tolerance: 1 },
    { id: 'arrivalNotice', name: '到港通知',     offsetFromETA: 1,   stdWindow: '到港后1-2天',     tolerance: 1 }
  ];

  /**
   * 解析日期字符串 (YYYY-MM-DD)
   */
  function parseDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  }

  /**
   * 计算两个日期的天数差
   */
  function daysBetween(d1, d2) {
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  /**
   * 格式化日期
   */
  function formatDate(d) {
    return d.getFullYear() + '-' + 
      String(d.getMonth()+1).padStart(2,'0') + '-' + 
      String(d.getDate()).padStart(2,'0');
  }

  /**
   * 主分析函数
   * @param {Object} workflowData - 流转单数据
   * @returns {Object} 分析结果
   */
  function analyze(workflowData) {
    const etd = parseDate(workflowData.etd);
    const eta = parseDate(workflowData.eta);
    
    if (!etd || !eta) {
      throw new Error('缺少ETD或ETA，无法进行时间分析');
    }

    const actualDates = {};
    if (workflowData.actualDates) {
      Object.keys(workflowData.actualDates).forEach(k => {
        actualDates[k] = parseDate(workflowData.actualDates[k]);
      });
    }

    // 构建节点分析结果
    const nodes = EXPORT_FCL_CHAIN.map(nodeDef => {
      let expectedDate;
      if (nodeDef.offsetFromETD !== undefined) {
        expectedDate = new Date(etd);
        expectedDate.setDate(expectedDate.getDate() + nodeDef.offsetFromETD);
      } else if (nodeDef.offsetFromETA !== undefined) {
        expectedDate = new Date(eta);
        expectedDate.setDate(expectedDate.getDate() + nodeDef.offsetFromETA);
      }

      const actualDate = actualDates[nodeDef.id] || null;
      let diffDays = null;
      let severity = 'normal';

      if (actualDate) {
        diffDays = daysBetween(expectedDate, actualDate);
        const absDiff = Math.abs(diffDays);
        if (absDiff > nodeDef.tolerance + 1) {
          severity = 'critical';
        } else if (absDiff > nodeDef.tolerance) {
          severity = 'warning';
        }
      }

      return {
        id: nodeDef.id,
        name: nodeDef.name,
        expectedDate: formatDate(expectedDate),
        actualDate: actualDate ? formatDate(actualDate) : null,
        stdWindow: nodeDef.stdWindow,
        diffDays: diffDays,
        severity: severity
      };
    });

    // 生成风险提示
    const risks = [];
    nodes.forEach(n => {
      if (n.severity === 'critical') {
        risks.push({
          level: 'high',
          nodeName: n.name,
          message: `严重延迟：实际${n.actualDate}，比标准时间${n.expectedDate}偏差${Math.abs(n.diffDays)}天，可能影响后续节点`
        });
      } else if (n.severity === 'warning') {
        risks.push({
          level: 'mid',
          nodeName: n.name,
          message: `轻微延迟：实际${n.actualDate}，比标准时间${n.expectedDate}偏差${Math.abs(n.diffDays)}天，请关注后续节点缓冲`
        });
      }
    });

    return {
      workflowInfo: {
        billNo: workflowData.billNo,
        mode: workflowData.mode,
        origin: workflowData.origin,
        destination: workflowData.destination,
        etd: workflowData.etd,
        eta: workflowData.eta,
        terms: workflowData.terms
      },
      nodes: nodes,
      risks: risks
    };
  }

  return { analyze: analyze };
})();
