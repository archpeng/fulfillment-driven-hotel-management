/**
 * iOS风格履约驱动酒店管理移动应用入口
 * PWA配置，支持添加到主屏幕
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { iOSFulfillmentApp } from './components/mobile/iOSFulfillmentApp';
import { iOSGuestDetail } from './components/mobile/iOSGuestDetail';

interface MobileAppState {
  currentView: 'app' | 'guest-detail' | 'offline';
  selectedGuestId: string | null;
  isOnline: boolean;
  installPrompt: any;
}

const MobileApp: React.FC = () => {
  const [appState, setAppState] = useState<MobileAppState>({
    currentView: 'app',
    selectedGuestId: null,
    isOnline: navigator.onLine,
    installPrompt: null
  });

  // PWA安装提示
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setAppState(prev => ({ ...prev, installPrompt: e }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => setAppState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setAppState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA安装
  const handleInstallApp = async () => {
    if (appState.installPrompt) {
      appState.installPrompt.prompt();
      const { outcome } = await appState.installPrompt.userChoice;
      console.log(`PWA安装: ${outcome}`);
      setAppState(prev => ({ ...prev, installPrompt: null }));
    }
  };

  // 处理客人操作
  const handleGuestAction = async (action: string) => {
    console.log('执行客人操作:', action);
    // 这里集成到实际的业务逻辑
  };

  // 离线模式界面
  if (!appState.isOnline) {
    return (
      <div className="offline-screen">
        <style jsx>{`
          .offline-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #F2F2F7;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            text-align: center;
            padding: 40px;
            color: #8E8E93;
          }

          .offline-icon {
            font-size: 64px;
            margin-bottom: 24px;
          }

          .offline-title {
            font-size: 20px;
            font-weight: 600;
            color: #000;
            margin-bottom: 8px;
          }

          .offline-message {
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 32px;
          }

          .offline-features {
            text-align: left;
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-top: 24px;
          }

          .offline-features h3 {
            font-size: 17px;
            font-weight: 600;
            color: #000;
            margin-bottom: 12px;
          }

          .offline-features ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .offline-features li {
            padding: 8px 0;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .feature-icon {
            color: #34C759;
          }
        `}</style>

        <div className="offline-icon">📱</div>
        <div className="offline-title">离线模式</div>
        <div className="offline-message">
          当前无网络连接<br />
          但您仍可以使用以下功能
        </div>

        <div className="offline-features">
          <h3>可用功能</h3>
          <ul>
            <li>
              <span className="feature-icon">✓</span>
              查看已缓存的客人信息
            </li>
            <li>
              <span className="feature-icon">✓</span>
              记录履约操作（稍后同步）
            </li>
            <li>
              <span className="feature-icon">✓</span>
              查看历史履约数据
            </li>
            <li>
              <span className="feature-icon">✓</span>
              生成离线报告
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <style jsx>{`
        .mobile-app {
          position: relative;
          max-width: 414px;
          margin: 0 auto;
          background: #F2F2F7;
          min-height: 100vh;
        }

        /* PWA安装横幅 */
        .install-banner {
          background: linear-gradient(135deg, #007AFF, #5856D6);
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 15px;
        }

        .install-button {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          cursor: pointer;
        }

        .install-button:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .dismiss-button {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          margin-left: 8px;
        }

        /* iOS状态栏适配 */
        .status-bar-spacer {
          height: env(safe-area-inset-top, 20px);
          background: #007AFF;
        }

        /* iOS主屏幕图标样式 */
        .app-icon {
          display: none;
        }

        @media (display-mode: standalone) {
          .app-icon {
            display: block;
          }
        }
      `}</style>

      {/* iOS状态栏间距 */}
      <div className="status-bar-spacer" />

      {/* PWA安装横幅 */}
      {appState.installPrompt && (
        <div className="install-banner">
          <div>
            <div style={{ fontWeight: 600 }}>🏨 履约驱动管理</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>添加到主屏幕，获得原生应用体验</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="install-button" onClick={handleInstallApp}>
              安装
            </button>
            <button 
              className="dismiss-button"
              onClick={() => setAppState(prev => ({ ...prev, installPrompt: null }))}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 主应用内容 */}
      {appState.currentView === 'app' && (
        <iOSFulfillmentApp 
          onSelectGuest={(guestId: string) => 
            setAppState(prev => ({ 
              ...prev, 
              currentView: 'guest-detail', 
              selectedGuestId: guestId 
            }))
          }
        />
      )}

      {/* 客人详情页 */}
      {appState.currentView === 'guest-detail' && appState.selectedGuestId && (
        <iOSGuestDetail
          guestId={appState.selectedGuestId}
          onBack={() => 
            setAppState(prev => ({ 
              ...prev, 
              currentView: 'app', 
              selectedGuestId: null 
            }))
          }
          onAction={handleGuestAction}
        />
      )}
    </div>
  );
};

// 初始化移动应用
const container = document.getElementById('mobile-root');
if (container) {
  const root = createRoot(container);
  root.render(<MobileApp />);
} else {
  console.error('移动应用容器未找到');
}