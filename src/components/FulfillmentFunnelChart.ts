/**
 * 履约状态漏斗图组件
 * 用于展示五阶段履约流程的转化漏斗，帮助酒店业主识别获客卡点
 */

import { FulfillmentStage } from '../domain/shared/value-objects/FulfillmentStage';

/**
 * 漏斗图数据接口
 */
export interface FunnelStageData {
  stage: FulfillmentStage;
  stageName: string;
  count: number;
  percentage: number;
  conversionRate: number; // 相对上一阶段的转化率
  isBottleneck: boolean; // 是否为转化瓶颈
  trend: 'up' | 'down' | 'stable'; // 趋势
  targetConversionRate?: number; // 目标转化率
}

/**
 * 漏斗图配置
 */
export interface FunnelChartConfig {
  width: number;
  height: number;
  colors: {
    [key: string]: string;
  };
  showLabels: boolean;
  showConversionRates: boolean;
  showTrends: boolean;
  highlightBottlenecks: boolean;
  animationDuration: number;
}

/**
 * 履约漏斗图组件
 */
export class FulfillmentFunnelChart {
  private container: HTMLElement;
  private config: FunnelChartConfig;
  private data: FunnelStageData[] = [];
  private svg?: SVGElement;

  constructor(containerId: string, config?: Partial<FunnelChartConfig>) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container ${containerId} not found`);
    }
    this.container = element;
    
    // 默认配置
    this.config = {
      width: 600,
      height: 400,
      colors: {
        awareness: '#3B82F6',     // 蓝色 - 认知阶段
        evaluation: '#8B5CF6',    // 紫色 - 评估阶段
        booking: '#10B981',       // 绿色 - 预订阶段
        experiencing: '#F59E0B',  // 黄色 - 体验阶段
        feedback: '#EF4444',      // 红色 - 反馈阶段
        bottleneck: '#DC2626',    // 瓶颈高亮色
        trend_up: '#10B981',
        trend_down: '#EF4444',
        trend_stable: '#6B7280'
      },
      showLabels: true,
      showConversionRates: true,
      showTrends: true,
      highlightBottlenecks: true,
      animationDuration: 800,
      ...config
    };
  }

  /**
   * 设置漏斗数据
   */
  public setData(rawData: { stage: string; count: number }[]): void {
    // 按履约阶段顺序排序
    const stageOrder = ['awareness', 'evaluation', 'booking', 'experiencing', 'feedback'];
    const sortedData = rawData.sort((a, b) => 
      stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
    );

    const totalCount = sortedData.reduce((sum, item) => sum + item.count, 0);
    
    this.data = sortedData.map((item, index) => {
      const stage = this.getStageFromString(item.stage);
      const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
      
      // 计算转化率（相对于上一阶段）
      let conversionRate = 100;
      if (index > 0) {
        const prevCount = sortedData[index - 1].count;
        conversionRate = prevCount > 0 ? (item.count / prevCount) * 100 : 0;
      }

      // 判断是否为瓶颈（转化率低于阈值）
      const isBottleneck = conversionRate < this.getBottleneckThreshold(item.stage);
      
      // 模拟趋势数据（实际项目中应从数据库获取）
      const trend = this.calculateTrend(item.stage, conversionRate);

      return {
        stage,
        stageName: this.getStageName(item.stage),
        count: item.count,
        percentage,
        conversionRate,
        isBottleneck,
        trend,
        targetConversionRate: this.getTargetConversionRate(item.stage)
      };
    });

    this.render();
  }

  /**
   * 渲染漏斗图
   */
  private render(): void {
    this.container.innerHTML = '';
    
    // 创建容器
    const wrapper = document.createElement('div');
    wrapper.className = 'fulfillment-funnel-wrapper';
    wrapper.style.cssText = `
      position: relative;
      width: 100%;
      background: #f8fafc;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;

    // 标题和总体统计
    const header = this.createHeader();
    wrapper.appendChild(header);

    // SVG漏斗图
    const svgContainer = this.createSVGFunnel();
    wrapper.appendChild(svgContainer);

    // 详细分析面板
    const analysisPanel = this.createAnalysisPanel();
    wrapper.appendChild(analysisPanel);

    this.container.appendChild(wrapper);
  }

  /**
   * 创建头部区域
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'funnel-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
    `;

    const totalGuests = this.data.reduce((sum, item) => sum + item.count, 0);
    const overallConversion = this.data.length > 0 
      ? ((this.data[this.data.length - 1].count / this.data[0].count) * 100).toFixed(1)
      : '0';

    header.innerHTML = `
      <div class="funnel-title">
        <h3 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0;">
          🎯 履约转化漏斗分析
        </h3>
        <p style="color: #6b7280; margin: 4px 0 0 0;">
          识别获客流程中的关键卡点和优化机会
        </p>
      </div>
      <div class="funnel-stats">
        <div style="text-align: right;">
          <div style="font-size: 32px; font-weight: 700; color: #059669;">
            ${totalGuests.toLocaleString()}
          </div>
          <div style="color: #6b7280; font-size: 14px;">总客人数</div>
        </div>
        <div style="text-align: right; margin-left: 32px;">
          <div style="font-size: 32px; font-weight: 700; color: #dc2626;">
            ${overallConversion}%
          </div>
          <div style="color: #6b7280; font-size: 14px;">整体转化率</div>
        </div>
      </div>
    `;

    return header;
  }

  /**
   * 创建SVG漏斗图
   */
  private createSVGFunnel(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'funnel-svg-container';
    container.style.cssText = `
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    `;

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', this.config.width.toString());
    svg.setAttribute('height', this.config.height.toString());
    svg.style.cssText = 'background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';

    // 绘制漏斗形状和数据
    this.drawFunnelShapes(svg);
    this.drawFunnelLabels(svg);
    this.drawConversionArrows(svg);

    container.appendChild(svg);
    this.svg = svg;

    return container;
  }

  /**
   * 绘制漏斗形状
   */
  private drawFunnelShapes(svg: SVGElement): void {
    const maxCount = Math.max(...this.data.map(d => d.count));
    const funnelWidth = this.config.width * 0.6;
    const funnelHeight = this.config.height * 0.8;
    const startY = 40;
    const stageHeight = funnelHeight / this.data.length;

    this.data.forEach((stageData, index) => {
      // 计算当前阶段的宽度（基于人数比例）
      const widthRatio = stageData.count / maxCount;
      const currentWidth = funnelWidth * widthRatio * 0.8 + funnelWidth * 0.2; // 最小宽度20%
      
      const y = startY + index * stageHeight;
      const x = (this.config.width - currentWidth) / 2;

      // 创建漏斗阶段矩形
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', currentWidth.toString());
      rect.setAttribute('height', (stageHeight * 0.8).toString());
      rect.setAttribute('rx', '8');
      
      const color = stageData.isBottleneck && this.config.highlightBottlenecks
        ? this.config.colors.bottleneck
        : this.config.colors[stageData.stage.value];
      
      rect.setAttribute('fill', color);
      rect.setAttribute('stroke', '#ffffff');
      rect.setAttribute('stroke-width', '2');
      rect.style.opacity = '0.9';
      rect.style.transition = `all ${this.config.animationDuration}ms ease-in-out`;

      // 添加悬停效果
      rect.addEventListener('mouseenter', () => {
        rect.style.opacity = '1';
        rect.style.transform = 'scale(1.02)';
      });
      
      rect.addEventListener('mouseleave', () => {
        rect.style.opacity = '0.9';
        rect.style.transform = 'scale(1)';
      });

      svg.appendChild(rect);

      // 添加瓶颈警告图标
      if (stageData.isBottleneck && this.config.highlightBottlenecks) {
        const warningIcon = this.createWarningIcon(x + currentWidth - 30, y + 10);
        svg.appendChild(warningIcon);
      }
    });
  }

  /**
   * 绘制标签和数据
   */
  private drawFunnelLabels(svg: SVGElement): void {
    if (!this.config.showLabels) return;

    const funnelHeight = this.config.height * 0.8;
    const startY = 40;
    const stageHeight = funnelHeight / this.data.length;

    this.data.forEach((stageData, index) => {
      const y = startY + index * stageHeight + (stageHeight * 0.4);
      const centerX = this.config.width / 2;

      // 阶段名称
      const stageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stageText.setAttribute('x', centerX.toString());
      stageText.setAttribute('y', (y - 10).toString());
      stageText.setAttribute('text-anchor', 'middle');
      stageText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
      stageText.setAttribute('font-size', '16');
      stageText.setAttribute('font-weight', '600');
      stageText.setAttribute('fill', '#1f2937');
      stageText.textContent = `${stageData.stageName}`;
      svg.appendChild(stageText);

      // 人数
      const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      countText.setAttribute('x', centerX.toString());
      countText.setAttribute('y', (y + 15).toString());
      countText.setAttribute('text-anchor', 'middle');
      countText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
      countText.setAttribute('font-size', '24');
      countText.setAttribute('font-weight', '700');
      countText.setAttribute('fill', '#ffffff');
      countText.textContent = stageData.count.toLocaleString();
      svg.appendChild(countText);

      // 转化率
      if (this.config.showConversionRates && index > 0) {
        const conversionText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        conversionText.setAttribute('x', centerX.toString());
        conversionText.setAttribute('y', (y + 35).toString());
        conversionText.setAttribute('text-anchor', 'middle');
        conversionText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
        conversionText.setAttribute('font-size', '14');
        conversionText.setAttribute('font-weight', '500');
        conversionText.setAttribute('fill', stageData.isBottleneck ? '#ffffff' : 'rgba(255,255,255,0.9)');
        conversionText.textContent = `${stageData.conversionRate.toFixed(1)}%`;
        svg.appendChild(conversionText);
      }
    });
  }

  /**
   * 绘制转化箭头
   */
  private drawConversionArrows(svg: SVGElement): void {
    const funnelHeight = this.config.height * 0.8;
    const startY = 40;
    const stageHeight = funnelHeight / this.data.length;

    for (let i = 0; i < this.data.length - 1; i++) {
      const currentY = startY + i * stageHeight + stageHeight * 0.8;
      const nextY = startY + (i + 1) * stageHeight;
      const centerX = this.config.width / 2;

      // 箭头路径
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${centerX - 15} ${currentY + 10} L ${centerX} ${nextY - 10} L ${centerX + 15} ${currentY + 10}`;
      arrow.setAttribute('d', d);
      arrow.setAttribute('stroke', this.data[i + 1].isBottleneck ? '#dc2626' : '#6b7280');
      arrow.setAttribute('stroke-width', '3');
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke-linecap', 'round');
      arrow.setAttribute('stroke-linejoin', 'round');

      svg.appendChild(arrow);
    }
  }

  /**
   * 创建分析面板
   */
  private createAnalysisPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'funnel-analysis-panel';
    panel.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 24px;
    `;

    // 瓶颈分析
    const bottleneckAnalysis = this.createBottleneckAnalysis();
    panel.appendChild(bottleneckAnalysis);

    // 优化建议
    const recommendations = this.createRecommendations();
    panel.appendChild(recommendations);

    return panel;
  }

  /**
   * 创建瓶颈分析
   */
  private createBottleneckAnalysis(): HTMLElement {
    const analysis = document.createElement('div');
    analysis.className = 'bottleneck-analysis';
    analysis.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const bottlenecks = this.data.filter(d => d.isBottleneck);
    
    analysis.innerHTML = `
      <h4 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">
        🚨 转化瓶颈分析
      </h4>
      ${bottlenecks.length === 0 
        ? '<p style="color: #059669;">🎉 恭喜！当前没有发现明显的转化瓶颈。</p>'
        : `<div style="space-y: 12px;">
            ${bottlenecks.map(bottleneck => `
              <div style="padding: 12px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">
                  ${bottleneck.stageName}
                </div>
                <div style="color: #6b7280; font-size: 14px;">
                  转化率: ${bottleneck.conversionRate.toFixed(1)}% 
                  (目标: ${bottleneck.targetConversionRate || 'N/A'}%)
                </div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                  影响客人: ${this.calculateLostCustomers(bottleneck)}人
                </div>
              </div>
            `).join('')}
          </div>`
      }
    `;

    return analysis;
  }

  /**
   * 创建优化建议
   */
  private createRecommendations(): HTMLElement {
    const recommendations = document.createElement('div');
    recommendations.className = 'optimization-recommendations';
    recommendations.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const suggestionsByStage = this.generateOptimizationSuggestions();

    recommendations.innerHTML = `
      <h4 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">
        💡 优化建议
      </h4>
      <div style="space-y: 12px;">
        ${suggestionsByStage.map(suggestion => `
          <div style="padding: 12px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
            <div style="font-weight: 600; color: #0ea5e9; margin-bottom: 4px;">
              ${suggestion.stage}
            </div>
            <div style="color: #6b7280; font-size: 14px;">
              ${suggestion.suggestion}
            </div>
            <div style="color: #059669; font-size: 12px; margin-top: 4px;">
              预期提升: ${suggestion.expectedImprovement}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return recommendations;
  }

  /**
   * 创建警告图标
   */
  private createWarningIcon(x: number, y: number): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x.toString());
    circle.setAttribute('cy', y.toString());
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', '#fbbf24');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x.toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', '#ffffff');
    text.textContent = '!';

    group.appendChild(circle);
    group.appendChild(text);

    return group;
  }

  /**
   * 辅助方法：从字符串获取FulfillmentStage
   */
  private getStageFromString(stage: string): FulfillmentStage {
    switch (stage) {
      case 'awareness': return FulfillmentStage.AWARENESS;
      case 'evaluation': return FulfillmentStage.EVALUATION;
      case 'booking': return FulfillmentStage.BOOKING;
      case 'experiencing': return FulfillmentStage.EXPERIENCING;
      case 'feedback': return FulfillmentStage.FEEDBACK;
      default: return FulfillmentStage.AWARENESS;
    }
  }

  /**
   * 获取阶段中文名称
   */
  private getStageName(stage: string): string {
    const names = {
      awareness: '认知阶段',
      evaluation: '评估阶段',
      booking: '预订阶段',
      experiencing: '体验阶段',
      feedback: '反馈阶段'
    };
    return names[stage as keyof typeof names] || stage;
  }

  /**
   * 获取瓶颈阈值
   */
  private getBottleneckThreshold(stage: string): number {
    const thresholds = {
      awareness: 100, // 认知阶段没有上一阶段，设为100%
      evaluation: 40, // 认知到评估的合理转化率
      booking: 25,    // 评估到预订的合理转化率
      experiencing: 85, // 预订到体验的合理转化率
      feedback: 70    // 体验到反馈的合理转化率
    };
    return thresholds[stage as keyof typeof thresholds] || 50;
  }

  /**
   * 获取目标转化率
   */
  private getTargetConversionRate(stage: string): number {
    const targets = {
      awareness: 100,
      evaluation: 50,
      booking: 30,
      experiencing: 90,
      feedback: 80
    };
    return targets[stage as keyof typeof targets] || 50;
  }

  /**
   * 计算趋势
   */
  private calculateTrend(stage: string, conversionRate: number): 'up' | 'down' | 'stable' {
    // 这里应该基于历史数据计算，目前使用模拟逻辑
    const target = this.getTargetConversionRate(stage);
    if (conversionRate > target * 1.1) return 'up';
    if (conversionRate < target * 0.9) return 'down';
    return 'stable';
  }

  /**
   * 计算流失客户数
   */
  private calculateLostCustomers(bottleneck: FunnelStageData): number {
    const currentIndex = this.data.findIndex(d => d.stage === bottleneck.stage);
    if (currentIndex <= 0) return 0;
    
    const previousStage = this.data[currentIndex - 1];
    const expectedCount = previousStage.count * (bottleneck.targetConversionRate || 50) / 100;
    return Math.max(0, Math.floor(expectedCount - bottleneck.count));
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(): Array<{stage: string, suggestion: string, expectedImprovement: string}> {
    const suggestions = [];
    
    this.data.forEach(stageData => {
      if (stageData.isBottleneck) {
        const stageSuggestions = this.getStageSuggestions(stageData.stage.value);
        suggestions.push({
          stage: stageData.stageName,
          suggestion: stageSuggestions.suggestion,
          expectedImprovement: stageSuggestions.expectedImprovement
        });
      }
    });

    return suggestions;
  }

  /**
   * 获取各阶段具体建议
   */
  private getStageSuggestions(stage: string): {suggestion: string, expectedImprovement: string} {
    const suggestions = {
      awareness: {
        suggestion: '加强品牌曝光和营销活动，优化SEO和社交媒体推广',
        expectedImprovement: '认知用户数提升20-30%'
      },
      evaluation: {
        suggestion: '优化产品展示页面，增加客户评价和案例展示，提供在线咨询服务',
        expectedImprovement: '评估转化率提升15-25%'
      },
      booking: {
        suggestion: '简化预订流程，提供优惠政策，增加支付方式，优化移动端体验',
        expectedImprovement: '预订转化率提升10-20%'
      },
      experiencing: {
        suggestion: '加强客户关系管理，及时跟进预订状态，提供预到店服务',
        expectedImprovement: '到店率提升5-15%'
      },
      feedback: {
        suggestion: '建立客户反馈激励机制，优化服务质量，增加满意度调研',
        expectedImprovement: '反馈率提升10-20%'
      }
    };
    
    return suggestions[stage as keyof typeof suggestions] || {
      suggestion: '分析具体数据，制定针对性优化方案',
      expectedImprovement: '转化率提升5-15%'
    };
  }

  /**
   * 更新数据（支持动态更新）
   */
  public updateData(newData: { stage: string; count: number }[]): void {
    this.setData(newData);
  }

  /**
   * 获取瓶颈数据（供外部调用）
   */
  public getBottlenecks(): FunnelStageData[] {
    return this.data.filter(d => d.isBottleneck);
  }

  /**
   * 导出图表为图片
   */
  public exportChart(): string {
    if (!this.svg) return '';
    
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise<string>((resolve) => {
      img.onload = () => {
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }) as any;
  }
}