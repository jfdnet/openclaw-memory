import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenClawMemory } from './memory.js';
import { ConfigManager } from './config.js';
import { URL } from 'url';

export class WebUIServer {
  private server: http.Server | null = null;
  private port: number;
  private memory: OpenClawMemory;
  private config: ConfigManager;

  constructor(port: number = 8080) {
    this.port = port;
    this.config = new ConfigManager();
    const configData = this.config.get();
    
    this.memory = new OpenClawMemory({
      workspacePath: configData.workspacePath,
      enableReflection: configData.enableReflection,
      reflectionInterval: configData.reflectionInterval
    });
  }

  async start(): Promise<void> {
    await this.memory.init();
    
    this.server = http.createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (error) {
        console.error('Request error:', error);
        this.sendError(res, 500, 'Internal Server Error');
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`🌐 Web UI running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      await this.handleAPI(req, res, pathname, url);
      return;
    }

    // Static files
    if (pathname === '/' || pathname === '/index.html') {
      this.sendHTML(res, this.getIndexHTML());
      return;
    }

    this.sendError(res, 404, 'Not Found');
  }

  private async handleAPI(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, url: URL): Promise<void> {
    const searchParams = url.searchParams;

    try {
      switch (pathname) {
        case '/api/search': {
          const query = searchParams.get('q') || '';
          const results = await this.memory.recall(query, { limit: 20 });
          this.sendJSON(res, { results });
          break;
        }

        case '/api/entities': {
          const entities = await this.memory.getEntities();
          this.sendJSON(res, { entities });
          break;
        }

        case '/api/stats': {
          const entities = await this.memory.getEntities();
          this.sendJSON(res, {
            entityCount: entities.length,
            workspacePath: this.config.get().workspacePath
          });
          break;
        }

        default:
          this.sendError(res, 404, 'API endpoint not found');
      }
    } catch (error) {
      this.sendError(res, 500, String(error));
    }
  }

  private sendHTML(res: http.ServerResponse, html: string): void {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private sendJSON(res: http.ServerResponse, data: unknown): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: http.ServerResponse, code: number, message: string): void {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  private getIndexHTML(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Memory</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; font-size: 24px; }
    .search-box { display: flex; gap: 10px; margin: 20px 0; }
    input[type="text"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }
    button { padding: 12px 24px; background: #007acc; color: white; border: none; border-radius: 6px; cursor: pointer; }
    button:hover { background: #005fa3; }
    .results { background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .fact { padding: 16px; border-bottom: 1px solid #eee; }
    .fact:last-child { border-bottom: none; }
    .fact-kind { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .kind-world { background: #e3f2fd; color: #1976d2; }
    .kind-experience { background: #e8f5e9; color: #388e3c; }
    .kind-opinion { background: #fff3e0; color: #f57c00; }
    .kind-observation { background: #f5f5f5; color: #616161; }
    .fact-content { color: #333; line-height: 1.6; }
    .fact-meta { color: #999; font-size: 12px; margin-top: 8px; }
    .loading { text-align: center; padding: 40px; color: #999; }
    .empty { text-align: center; padding: 40px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧠 OpenClaw Memory</h1>
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="搜索记忆..." />
        <button onclick="search()">搜索</button>
      </div>
    </header>
    
    <div id="results" class="results"></div>
  </div>

  <script>
    async function search() {
      const query = document.getElementById('searchInput').value;
      const resultsDiv = document.getElementById('results');
      
      if (!query) return;
      
      resultsDiv.innerHTML = '<div class="loading">搜索中...</div>';
      
      try {
        const response = await fetch('/api/search?q=' + encodeURIComponent(query));
        const data = await response.json();
        
        if (data.results.length === 0) {
          resultsDiv.innerHTML = '<div class="empty">未找到相关记忆</div>';
          return;
        }
        
        resultsDiv.innerHTML = data.results.map(fact => \`
          <div class="fact">
            <span class="fact-kind kind-\${fact.kind}">\${fact.kind.toUpperCase()}</span>
            <div class="fact-content">\${escapeHtml(fact.content)}</div>
            <div class="fact-meta">
              来源: \${fact.source} | 时间: \${fact.timestamp}
              \${fact.confidence ? '| 置信度: ' + fact.confidence : ''}
            </div>
          </div>
        \`).join('');
      } catch (error) {
        resultsDiv.innerHTML = '<div class="empty">搜索失败: ' + error.message + '</div>';
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // 回车搜索
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') search();
    });
  </script>
</body>
</html>`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🌐 Web UI stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}