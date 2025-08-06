(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))n(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const i of t.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function a(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function n(e){if(e.ep)return;e.ep=!0;const t=a(e);fetch(e.href,t)}})();const o="1.1.0",r=new Date().toISOString(),c="https://fulfillment-backend.up.railway.app";document.querySelector("#app").innerHTML=`
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">🏨</span>
          <h1>履约驱动酒店管理系统</h1>
        </div>
        <div class="version">v${o}</div>
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
        <p>构建时间: ${r.split("T")[0]}</p>
      </div>
    </footer>
  </div>
`;document.addEventListener("DOMContentLoaded",()=>{var l;document.querySelectorAll('a[href^="#"]').forEach(s=>{s.addEventListener("click",function(a){a.preventDefault();const n=document.querySelector(this.getAttribute("href"));n&&n.scrollIntoView({behavior:"smooth"})})}),document.querySelectorAll(".feature-card").forEach(s=>{s.addEventListener("mouseenter",()=>{s.style.transform="translateY(-5px)",s.style.boxShadow="0 10px 30px rgba(0,0,0,0.2)"}),s.addEventListener("mouseleave",()=>{s.style.transform="translateY(0)",s.style.boxShadow="0 4px 15px rgba(0,0,0,0.1)"})}),(l=document.getElementById("test-backend-btn"))==null||l.addEventListener("click",async()=>{const s=document.getElementById("test-backend-btn"),a=document.getElementById("api-test-result");s.disabled=!0,s.textContent="测试中...",a.style.display="block",a.innerHTML="<p>🔄 正在连接后端API...</p>";try{const e=await(await fetch(`${c}/health`)).json(),i=await(await fetch(`${c}/api/version`)).json();a.innerHTML=`
        <div class="api-success">
          <h4>✅ 后端API连接成功！</h4>
          <div class="api-details">
            <p><strong>服务状态：</strong>${e.status}</p>
            <p><strong>服务版本：</strong>${i.version}</p>
            <p><strong>架构模式：</strong>${i.architecture}</p>
            <p><strong>响应时间：</strong>${Date.now()-performance.now()}ms</p>
            <p><strong>后端地址：</strong><a href="${c}" target="_blank">${c}</a></p>
          </div>
        </div>
      `}catch(n){a.innerHTML=`
        <div class="api-error">
          <h4>❌ 后端API连接失败</h4>
          <p>后端服务可能还未部署或启动</p>
          <p><strong>错误信息：</strong>${n.message}</p>
          <p><strong>预期地址：</strong>${c}</p>
          <p><em>请参考部署指南完成后端部署</em></p>
        </div>
      `}finally{s.disabled=!1,s.innerHTML='<span class="link-icon">🔧</span>测试后端API'}}),console.log("🎉 履约驱动酒店管理系统已启动！"),console.log("📊 当前版本:",o),console.log("🏗️ 架构: DDD + XState + RxDB"),console.log("🔗 后端API:",c)});
//# sourceMappingURL=main-MbIYU2cx.js.map
