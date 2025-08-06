/**
 * iOS风格客人详情页面
 * 履约历程可视化和快速操作界面
 */

import React, { useState, useEffect } from 'react';
import { Guest } from '../domain/guests/aggregates/Guest';
import { FulfillmentStage } from '../domain/shared/value-objects/FulfillmentStage';

interface iOSGuestDetailProps {
  guestId: string;
  onBack: () => void;
  onAction: (action: string) => Promise<void>;
}

interface FulfillmentProgress {
  stage: string;
  displayName: string;
  completed: boolean;
  current: boolean;
  progress: number;
  startTime?: Date;
  completedTime?: Date;
  estimatedTime?: Date;
  actions: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    urgent: boolean;
  }>;
}

export const iOSGuestDetail: React.FC<iOSGuestDetailProps> = ({
  guestId,
  onBack,
  onAction
}) => {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journey' | 'profile' | 'history'>('journey');

  // 履约阶段进度数据
  const fulfillmentProgress: FulfillmentProgress[] = [
    {
      stage: 'awareness',
      displayName: '认知阶段',
      completed: true,
      current: false,
      progress: 100,
      completedTime: new Date('2024-08-01'),
      actions: []
    },
    {
      stage: 'evaluation',
      displayName: '评估阶段',
      completed: true,
      current: false,
      progress: 100,
      completedTime: new Date('2024-08-02'),
      actions: []
    },
    {
      stage: 'booking',
      displayName: '预订阶段',
      completed: false,
      current: true,
      progress: 65,
      startTime: new Date('2024-08-03'),
      estimatedTime: new Date('2024-08-07'),
      actions: [
        {
          id: 'confirm_booking',
          label: '确认预订',
          icon: '✅',
          color: '#34C759',
          urgent: true
        },
        {
          id: 'send_reminder',
          label: '发送提醒',
          icon: '📱',
          color: '#FF9500',
          urgent: false
        },
        {
          id: 'offer_upgrade',
          label: '推荐升级',
          icon: '⬆️',
          color: '#5856D6',
          urgent: false
        }
      ]
    },
    {
      stage: 'experiencing',
      displayName: '体验阶段',
      completed: false,
      current: false,
      progress: 0,
      actions: []
    },
    {
      stage: 'feedback',
      displayName: '反馈阶段', 
      completed: false,
      current: false,
      progress: 0,
      actions: []
    }
  ];

  const handleQuickAction = async (actionId: string) => {
    try {
      await onAction(actionId);
      // iOS触觉反馈
      if ('navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  useEffect(() => {
    // 模拟加载客人数据
    const loadGuestData = async () => {
      setIsLoading(true);
      // 这里应该从RxDB加载真实数据
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    };

    loadGuestData();
  }, [guestId]);

  if (isLoading) {
    return (
      <div className="ios-guest-detail loading">
        <div className="ios-loading-indicator">
          <div className="spinner"></div>
          <div>加载客人信息中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-guest-detail">
      <style jsx>{`
        .ios-guest-detail {
          max-width: 414px;
          margin: 0 auto;
          background: #F2F2F7;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* 导航栏 */
        .ios-nav-bar {
          height: 44px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 0.5px solid #C6C6C8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-back-button {
          color: #007AFF;
          font-size: 17px;
          background: none;
          border: none;
          padding: 8px 0;
          cursor: pointer;
        }

        .nav-title {
          font-size: 17px;
          font-weight: 600;
          color: #000;
        }

        /* 客人卡片 */
        .guest-card {
          background: white;
          margin: 8px 16px 16px;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .guest-header {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }

        .guest-avatar-large {
          width: 60px;
          height: 60px;
          border-radius: 30px;
          background: linear-gradient(135deg, #007AFF, #5856D6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: 600;
          margin-right: 16px;
        }

        .guest-basic-info h2 {
          font-size: 20px;
          font-weight: 600;
          color: #000;
          margin: 0 0 4px 0;
        }

        .guest-basic-info p {
          font-size: 15px;
          color: #8E8E93;
          margin: 0;
        }

        .guest-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 0.5px solid #C6C6C8;
        }

        .stat-item {
          text-align: center;
          flex: 1;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #000;
        }

        .stat-label {
          font-size: 12px;
          color: #8E8E93;
          margin-top: 2px;
        }

        /* 标签页 */
        .ios-segment-control {
          background: white;
          margin: 0 16px 16px;
          border-radius: 12px;
          padding: 4px;
          display: flex;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .segment-item {
          flex: 1;
          text-align: center;
          padding: 8px;
          font-size: 15px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #8E8E93;
        }

        .segment-item.active {
          background: #007AFF;
          color: white;
          font-weight: 500;
        }

        /* 履约历程 */
        .fulfillment-journey {
          background: white;
          margin: 0 16px 16px;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .journey-stage {
          display: flex;
          align-items: flex-start;
          margin-bottom: 24px;
          position: relative;
        }

        .journey-stage:last-child {
          margin-bottom: 0;
        }

        .journey-stage::after {
          content: '';
          position: absolute;
          left: 19px;
          top: 38px;
          width: 2px;
          height: calc(100% + 4px);
          background: #E5E5EA;
        }

        .journey-stage:last-child::after {
          display: none;
        }

        .journey-stage.completed::after {
          background: #34C759;
        }

        .stage-indicator {
          width: 38px;
          height: 38px;
          border-radius: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          flex-shrink: 0;
          z-index: 1;
          position: relative;
        }

        .stage-indicator.completed {
          background: #34C759;
          color: white;
        }

        .stage-indicator.current {
          background: #007AFF;
          color: white;
        }

        .stage-indicator.pending {
          background: #E5E5EA;
          color: #8E8E93;
        }

        .stage-content {
          flex: 1;
          padding-top: 4px;
        }

        .stage-title {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          margin-bottom: 4px;
        }

        .stage-progress {
          font-size: 14px;
          color: #8E8E93;
          margin-bottom: 8px;
        }

        .progress-bar {
          height: 4px;
          background: #E5E5EA;
          border-radius: 2px;
          margin: 8px 0;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #007AFF;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* 快速操作 */
        .quick-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .action-button {
          background: #F2F2F7;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 14px;
          color: #007AFF;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-button:active {
          background: #E1E1E6;
          transform: scale(0.95);
        }

        .action-button.urgent {
          background: #FF3B30;
          color: white;
        }

        .action-button.urgent:active {
          background: #D70015;
        }

        /* 加载状态 */
        .ios-loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          color: #8E8E93;
          font-size: 16px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #E5E5EA;
          border-top: 3px solid #007AFF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* 响应式适配 iPhone SE */
        @media (max-width: 375px) {
          .guest-card {
            margin: 8px 12px 16px;
            padding: 16px;
          }
          
          .ios-segment-control, .fulfillment-journey {
            margin-left: 12px;
            margin-right: 12px;
          }
        }
      `}</style>

      {/* 导航栏 */}
      <div className="ios-nav-bar">
        <button className="nav-back-button" onClick={onBack}>
          ← 返回
        </button>
        <div className="nav-title">客人详情</div>
        <div style={{ width: 44 }}></div>
      </div>

      {/* 客人信息卡片 */}
      <div className="guest-card">
        <div className="guest-header">
          <div className="guest-avatar-large">张</div>
          <div className="guest-basic-info">
            <h2>张三</h2>
            <p>138-0000-0000 • VIP客户</p>
          </div>
        </div>
        
        <div className="guest-stats">
          <div className="stat-item">
            <div className="stat-value">¥12,800</div>
            <div className="stat-label">终身价值</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">黄金</div>
            <div className="stat-label">忠诚等级</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">65%</div>
            <div className="stat-label">履约进度</div>
          </div>
        </div>
      </div>

      {/* 分段控制器 */}
      <div className="ios-segment-control">
        <div 
          className={`segment-item ${activeTab === 'journey' ? 'active' : ''}`}
          onClick={() => setActiveTab('journey')}
        >
          履约历程
        </div>
        <div 
          className={`segment-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          客人档案
        </div>
        <div 
          className={`segment-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          操作历史
        </div>
      </div>

      {/* 履约历程标签页 */}
      {activeTab === 'journey' && (
        <div className="fulfillment-journey">
          {fulfillmentProgress.map((stage, index) => (
            <div 
              key={stage.stage}
              className={`journey-stage ${stage.completed ? 'completed' : ''}`}
            >
              <div className={`stage-indicator ${
                stage.completed ? 'completed' : 
                stage.current ? 'current' : 'pending'
              }`}>
                {stage.completed ? '✓' : 
                 stage.current ? index + 1 : index + 1}
              </div>
              
              <div className="stage-content">
                <div className="stage-title">{stage.displayName}</div>
                <div className="stage-progress">
                  进度: {stage.progress}%
                  {stage.startTime && ` • 开始于 ${stage.startTime.toLocaleDateString()}`}
                </div>
                
                {stage.current && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                )}

                {/* 快速操作按钮 */}
                {stage.actions.length > 0 && (
                  <div className="quick-actions">
                    {stage.actions.map(action => (
                      <button
                        key={action.id}
                        className={`action-button ${action.urgent ? 'urgent' : ''}`}
                        onClick={() => handleQuickAction(action.id)}
                      >
                        <span>{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 其他标签页内容 */}
      {activeTab === 'profile' && (
        <div className="fulfillment-journey">
          <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>
            客人档案功能开发中...
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="fulfillment-journey">
          <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>
            操作历史功能开发中...
          </div>
        </div>
      )}
    </div>
  );
};