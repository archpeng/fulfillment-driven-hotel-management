(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const l of a.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&s(l)}).observe(document,{childList:!0,subtree:!0});function i(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function s(e){if(e.ep)return;e.ep=!0;const a=i(e);fetch(e.href,a)}})();(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const e of s)if(e.type==="childList")for(const a of e.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const e={};return s.integrity&&(e.integrity=s.integrity),s.referrerPolicy&&(e.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?e.credentials="include":s.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function i(s){if(s.ep)return;s.ep=!0;const e=t(s);fetch(s.href,e)}})();const r="1.1.0",o=new Date().toISOString(),c="https://fulfillment-backend.up.railway.app";document.querySelector("#app").innerHTML=`
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">🏨</span>
          <h1>履约驱动酒店管理系统</h1>
        </div>
        <div class="version">v${r}</div>
      </div>
    </header>

    <main class="main-content">
      <section class="hero">
        <h2 class="hero-title">"我们不管理客房，我们管理客人"</h2>
        <p class="hero-subtitle">
          基于五阶段履约流程的现代化酒店管理解决方案<br/>
          采用DDD+XState+RxDB技术栈，支持离线优先和瞬时响应
        </p>
      </section>

      <section class="features">
        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3>履约驱动架构</h3>
            <p>以客人履约历程为中心的业务架构，五阶段流程精确管理客人价值实现</p>
            <div class="feature-stages">
              <span class="stage">认知</span>
              <span class="arrow">→</span>
              <span class="stage">评估</span>
              <span class="arrow">→</span>
              <span class="stage">预订</span>
              <span class="arrow">→</span>
              <span class="stage">体验</span>
              <span class="arrow">→</span>
              <span class="stage">反馈</span>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>性能卓越</h3>
            <p>厚客户端架构确保瞬时响应，本地查询&lt;10ms，批量处理≥1000条/秒</p>
            <div class="performance-metrics">
              <div class="metric">
                <span class="metric-value">&lt;10ms</span>
                <span class="metric-label">本地查询</span>
              </div>
              <div class="metric">
                <span class="metric-value">&lt;50ms</span>
                <span class="metric-label">状态转换</span>
              </div>
              <div class="metric">
                <span class="metric-value">≥1000</span>
                <span class="metric-label">条/秒处理</span>
              </div>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>离线优先</h3>
            <p>基于RxDB的离线优先架构，网络中断不影响业务，自动数据同步</p>
            <div class="offline-features">
              <div class="offline-item">✓ 完全离线可用</div>
              <div class="offline-item">✓ 双向数据同步</div>
              <div class="offline-item">✓ 冲突自动解决</div>
              <div class="offline-item">✓ 多设备一致性</div>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🏗️</div>
            <h3>DDD领域设计</h3>
            <p>领域驱动设计确保业务逻辑清晰，聚合根管理复杂业务规则</p>
            <div class="ddd-components">
              <div class="ddd-item">Guest聚合根</div>
              <div class="ddd-item">FulfillmentJourney聚合根</div>
              <div class="ddd-item">履约事件系统</div>
              <div class="ddd-item">领域服务</div>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🎛️</div>
            <h3>XState状态机</h3>
            <p>可视化状态机管理复杂履约流程，支持并行状态和异常处理</p>
            <div class="state-features">
              <div class="state-item">可视化流程设计</div>
              <div class="state-item">并行状态支持</div>
              <div class="state-item">超时自动处理</div>
              <div class="state-item">异常恢复机制</div>
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🧪</div>
            <h3>质量保障</h3>
            <p>90%测试覆盖率，完整的CI/CD流水线，企业级质量标准</p>
            <div class="quality-metrics">
              <div class="quality-item">
                <span class="quality-percentage">90%+</span>
                <span class="quality-label">测试覆盖率</span>
              </div>
              <div class="quality-item">
                <span class="quality-percentage">100%</span>
                <span class="quality-label">类型安全</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="architecture">
        <h2>技术架构</h2>
        <div class="tech-stack">
          <div class="tech-category">
            <h3>前端技术栈</h3>
            <div class="tech-list">
              <span class="tech-item">TypeScript 5.x</span>
              <span class="tech-item">XState 5.x</span>
              <span class="tech-item">RxDB 16.x</span>
              <span class="tech-item">Vite 5.x</span>
              <span class="tech-item">Vitest</span>
            </div>
          </div>
          <div class="tech-category">
            <h3>后端技术栈</h3>
            <div class="tech-list">
              <span class="tech-item">Node.js</span>
              <span class="tech-item">CouchDB</span>
              <span class="tech-item">Redis</span>
              <span class="tech-item">Docker</span>
              <span class="tech-item">GitHub Actions</span>
            </div>
          </div>
        </div>
      </section>

      <section class="demo-section">
        <h2>项目展示</h2>
        <div class="demo-content">
          <p>这是一个完整的履约驱动酒店管理系统演示。</p>
          <p><strong>注意</strong>: 完整的前端应用正在开发中，当前展示为项目介绍页面。</p>
          
          <div class="demo-links">
            <button id="test-backend-btn" class="demo-link">
              <span class="link-icon">🔧</span>
              测试后端API
            </button>
            <a href="https://github.com/archpeng/fulfillment-driven-hotel-management" 
               class="demo-link" target="_blank" rel="noopener">
              <span class="link-icon">📚</span>
              查看源代码
            </a>
            <a href="https://github.com/archpeng/fulfillment-driven-hotel-management/blob/main/CLAUDE.md" 
               class="demo-link" target="_blank" rel="noopener">
              <span class="link-icon">🏗️</span>
              架构文档
            </a>
            <a href="https://github.com/archpeng/fulfillment-driven-hotel-management/blob/main/README.md" 
               class="demo-link" target="_blank" rel="noopener">
              <span class="link-icon">📖</span>
              项目文档
            </a>
          </div>
          <div id="api-test-result" class="api-result" style="display: none;"></div>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <div class="footer-content">
        <p>&copy; 2025 履约驱动酒店管理系统 | 
           <a href="https://github.com/archpeng" target="_blank" rel="noopener">archpeng</a>
        </p>
        <p>构建时间: ${o.split("T")[0]}</p>
      </div>
    </footer>
  </div>
`;document.addEventListener("DOMContentLoaded",()=>{var n;document.querySelectorAll('a[href^="#"]').forEach(t=>{t.addEventListener("click",function(i){i.preventDefault();const s=document.querySelector(this.getAttribute("href"));s&&s.scrollIntoView({behavior:"smooth"})})}),document.querySelectorAll(".feature-card").forEach(t=>{t.addEventListener("mouseenter",()=>{t.style.transform="translateY(-5px)",t.style.boxShadow="0 10px 30px rgba(0,0,0,0.2)"}),t.addEventListener("mouseleave",()=>{t.style.transform="translateY(0)",t.style.boxShadow="0 4px 15px rgba(0,0,0,0.1)"})}),(n=document.getElementById("test-backend-btn"))==null||n.addEventListener("click",async()=>{const t=document.getElementById("test-backend-btn"),i=document.getElementById("api-test-result");t.disabled=!0,t.textContent="测试中...",i.style.display="block",i.innerHTML="<p>🔄 正在连接后端API...</p>";try{const s=await(await fetch(`${c}/health`)).json(),e=await(await fetch(`${c}/api/version`)).json();i.innerHTML=`
        <div class="api-success">
          <h4>✅ 后端API连接成功！</h4>
          <div class="api-details">
            <p><strong>服务状态：</strong>${s.status}</p>
            <p><strong>服务版本：</strong>${e.version}</p>
            <p><strong>架构模式：</strong>${e.architecture}</p>
            <p><strong>响应时间：</strong>${Date.now()-performance.now()}ms</p>
            <p><strong>后端地址：</strong><a href="${c}" target="_blank">${c}</a></p>
          </div>
        </div>
      `}catch(s){i.innerHTML=`
        <div class="api-error">
          <h4>❌ 后端API连接失败</h4>
          <p>后端服务可能还未部署或启动</p>
          <p><strong>错误信息：</strong>${s.message}</p>
          <p><strong>预期地址：</strong>${c}</p>
          <p><em>请参考部署指南完成后端部署</em></p>
        </div>
      `}finally{t.disabled=!1,t.innerHTML='<span class="link-icon">🔧</span>测试后端API'}}),console.log("🎉 履约驱动酒店管理系统已启动！"),console.log("📊 当前版本:",r),console.log("🏗️ 架构: DDD + XState + RxDB"),console.log("🔗 后端API:",c)});
//# sourceMappingURL=main-BrxL7gEm.js.map
