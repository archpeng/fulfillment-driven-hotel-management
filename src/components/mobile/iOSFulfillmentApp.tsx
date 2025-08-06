/**
 * iOS原生风格履约驱动酒店管理应用
 * 专为iPhone优化的客人履约管理界面
 * "我们不管理客房，我们管理客人"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Guest } from '../domain/guests/aggregates/Guest';
import { FulfillmentJourney } from '../domain/fulfillment/aggregates/FulfillmentJourney';
import { FulfillmentStage } from '../domain/shared/value-objects/FulfillmentStage';
import { rxdbManager } from '../database/RxDBManager';

interface iOSFulfillmentAppProps {
  className?: string;
}

interface GuestSummary {
  id: string;
  name: string;
  phone: string;
  currentStage: string;
  overallProgress: number;
  loyaltyLevel: string;
  lifetimeValue: number;
  urgentActions: string[];
  stageStartTime: Date;
  estimatedCompletion?: Date;
}

export const iOSFulfillmentApp: React.FC<iOSFulfillmentAppProps> = ({ className }) => {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestSummary | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'actions'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // iOS风格的状态颜色映射
  const stageColors = {
    'awareness': '#007AFF',      // iOS Blue
    'evaluation': '#FF9500',     // iOS Orange  
    'booking': '#FF3B30',        // iOS Red
    'experiencing': '#34C759',   // iOS Green
    'feedback': '#5856D6',       // iOS Purple
  };

  const loyaltyColors = {
    'bronze': '#CD7F32',
    'silver': '#C0C0C0', 
    'gold': '#FFD700',
    'platinum': '#E5E4E2'
  };

  // 加载客人数据
  const loadGuests = useCallback(async () => {
    try {
      const guestsCollection = await rxdbManager.getCollection('guests');
      const allGuests = await guestsCollection.find().exec();
      
      const guestSummaries: GuestSummary[] = allGuests.map(guest => {
        const guestData = guest.toJSON();
        return {
          id: guestData.id,
          name: guestData.personalInfo.name,
          phone: guestData.personalInfo.phone,
          currentStage: guestData.fulfillmentHistory.currentStage,
          overallProgress: Math.round(guestData.fulfillmentHistory.overallProgress || 0),
          loyaltyLevel: guestData.tags.loyaltyLevel,
          lifetimeValue: guestData.businessMetrics.lifetimeValue || 0,
          urgentActions: guestData.urgentActions || [],
          stageStartTime: new Date(guestData.fulfillmentHistory.stageStartTime),
          estimatedCompletion: guestData.fulfillmentHistory.estimatedCompletion 
            ? new Date(guestData.fulfillmentHistory.estimatedCompletion)
            : undefined
        };
      });

      // 按紧急程度和阶段优先级排序
      guestSummaries.sort((a, b) => {
        const urgencyScore = (g: GuestSummary) => 
          g.urgentActions.length * 10 + 
          (g.currentStage === 'booking' ? 5 : 0) +
          (g.currentStage === 'experiencing' ? 3 : 0);
        
        return urgencyScore(b) - urgencyScore(a);
      });

      setGuests(guestSummaries);
    } catch (error) {
      console.error('加载客人数据失败:', error);
    }
  }, []);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadGuests();
    setTimeout(() => setIsRefreshing(false), 500); // iOS风格的刷新动画
  }, [loadGuests]);

  // 快速操作
  const handleQuickAction = useCallback(async (guestId: string, action: string) => {
    try {
      const guestsCollection = await rxdbManager.getCollection('guests');
      const guest = await guestsCollection.findOne(guestId).exec();
      
      if (guest) {
        // 触发履约事件
        const eventData = {
          type: action,
          timestamp: new Date(),
          guestId: guestId,
          source: 'ios_mobile_app',
          impact: action === 'advance_stage' ? 15 : 5
        };

        // 这里可以集成到XState状态机
        console.log('执行快速操作:', eventData);
        
        // 使用iOS触觉反馈
        if ('navigator' in window && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        await loadGuests(); // 刷新数据
      }
    } catch (error) {
      console.error('快速操作失败:', error);
    }
  }, [loadGuests]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  // 过滤客人
  const filteredGuests = guests.filter(guest => 
    guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.phone.includes(searchQuery)
  );

  return (
    <div className={`ios-fulfillment-app ${className || ''}`}>
      <style jsx>{`
        .ios-fulfillment-app {
          max-width: 414px;
          margin: 0 auto;
          background: #F2F2F7;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding-bottom: 83px; /* Tab bar height */
        }

        /* iOS状态栏 */
        .ios-status-bar {
          height: 44px;
          background: #007AFF;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 17px;
        }

        /* iOS搜索栏 */
        .ios-search-bar {
          padding: 8px 16px;
          background: white;
        }

        .ios-search-input {
          width: 100%;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          background: #F2F2F7;
          font-size: 17px;
          outline: none;
        }

        /* iOS列表样式 */
        .ios-guest-list {
          background: white;
          margin: 8px 0;
        }

        .ios-guest-item {
          padding: 16px;
          border-bottom: 0.5px solid #C6C6C8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          tap-highlight-color: transparent;
          -webkit-tap-highlight-color: transparent;
          transition: background-color 0.15s;
        }

        .ios-guest-item:active {
          background-color: #E9E9EB;
        }

        .ios-guest-item:last-child {
          border-bottom: none;
        }

        .guest-avatar {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background: linear-gradient(135deg, #007AFF, #5856D6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .guest-info {
          flex: 1;
          margin-left: 12px;
        }

        .guest-name {
          font-size: 17px;
          font-weight: 400;
          color: #000;
          margin-bottom: 2px;
        }

        .guest-stage {
          font-size: 13px;
          color: #8E8E93;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stage-indicator {
          width: 8px;
          height: 8px;
          border-radius: 4px;
        }

        .guest-metrics {
          text-align: right;
        }

        .loyalty-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          margin-bottom: 2px;
        }

        .progress-text {
          font-size: 13px;
          color: #8E8E93;
        }

        /* iOS按钮样式 */
        .ios-button {
          background: #007AFF;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .ios-button:active {
          opacity: 0.6;
        }

        .ios-button-secondary {
          background: #F2F2F7;
          color: #007AFF;
        }

        /* iOS Tab Bar */
        .ios-tab-bar {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 414px;
          height: 83px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-top: 0.5px solid #C6C6C8;
          display: flex;
          justify-content: space-around;
          align-items: flex-start;
          padding-top: 8px;
        }

        .ios-tab-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px;
          color: #8E8E93;
          text-decoration: none;
          font-size: 10px;
          transition: color 0.15s;
        }

        .ios-tab-item.active {
          color: #007AFF;
        }

        .ios-tab-icon {
          width: 24px;
          height: 24px;
          margin-bottom: 2px;
        }

        /* 刷新指示器 */
        .refresh-indicator {
          text-align: center;
          padding: 16px;
          color: #8E8E93;
          font-size: 15px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        /* iOS风格紧急标记 */
        .urgent-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 8px;
          height: 8px;
          background: #FF3B30;
          border-radius: 4px;
        }

        /* 响应式适配 */
        @media (max-width: 375px) {
          .guest-info {
            margin-left: 8px;
          }
          
          .guest-name {
            font-size: 16px;
          }
        }
      `}</style>

      {/* iOS状态栏 */}
      <div className="ios-status-bar">
        🏨 履约驱动管理
      </div>

      {/* iOS搜索栏 */}
      <div className="ios-search-bar">
        <input
          type="text"
          className="ios-search-input"
          placeholder="搜索客人姓名或电话"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 刷新指示器 */}
      {isRefreshing && (
        <div className="refresh-indicator">
          <span className="spinning">↻</span> 正在刷新客人信息...
        </div>
      )}

      {/* 客人列表 */}
      <div className="ios-guest-list">
        {filteredGuests.map((guest) => (
          <div
            key={guest.id}
            className="ios-guest-item"
            onClick={() => setSelectedGuest(guest)}
            style={{ position: 'relative' }}
          >
            {/* 紧急标记 */}
            {guest.urgentActions.length > 0 && (
              <div className="urgent-indicator" />
            )}

            {/* 客人头像 */}
            <div className="guest-avatar">
              {guest.name.charAt(0)}
            </div>

            {/* 客人信息 */}
            <div className="guest-info">
              <div className="guest-name">{guest.name}</div>
              <div className="guest-stage">
                <span 
                  className="stage-indicator"
                  style={{ 
                    backgroundColor: stageColors[guest.currentStage as keyof typeof stageColors] || '#8E8E93'
                  }}
                />
                {FulfillmentStage.getDisplayName(guest.currentStage)} • {guest.overallProgress}%
              </div>
            </div>

            {/* 客人指标 */}
            <div className="guest-metrics">
              <div 
                className="loyalty-badge"
                style={{ 
                  backgroundColor: loyaltyColors[guest.loyaltyLevel as keyof typeof loyaltyColors] || '#8E8E93'
                }}
              >
                {guest.loyaltyLevel.toUpperCase()}
              </div>
              <div className="progress-text">
                ¥{guest.lifetimeValue.toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {filteredGuests.length === 0 && !isRefreshing && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#8E8E93' }}>
            {searchQuery ? '未找到匹配的客人' : '暂无客人数据'}
          </div>
        )}
      </div>

      {/* iOS Tab Bar */}
      <div className="ios-tab-bar">
        <div className="ios-tab-item active">
          <div className="ios-tab-icon">👥</div>
          <span>客人</span>
        </div>
        <div className="ios-tab-item">
          <div className="ios-tab-icon">📊</div>
          <span>履约</span>
        </div>
        <div className="ios-tab-item">
          <div className="ios-tab-icon">⚡</div>
          <span>操作</span>
        </div>
        <div className="ios-tab-item">
          <div className="ios-tab-icon">⚙️</div>
          <span>设置</span>
        </div>
      </div>
    </div>
  );
};