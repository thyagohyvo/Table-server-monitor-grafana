# Table-server-monitor-grafana
# ⬡ Neon Server Monitor — Grafana HTML Graphics Panel

> Dashboard estilo **cyberpunk/neon** para monitoramento de servidores em tempo real, construído com o plugin [Grafana HTML Graphics](https://github.com/gapitio/gapit-htmlgraphics-panel).

![Preview](preview.png)

---

## ✦ Visão Geral

Painel interativo que exibe métricas de infraestrutura (CPU, Memória, Disco e Uptime) com visual neon, scanlines e animações de alerta — tudo dentro de um único panel do Grafana sem dependências externas de frontend.

**Funcionalidades:**
- Status UP/DOWN com dot animado
- Barras de progresso coloridas por threshold (verde → amarelo → laranja → vermelho)
- Blink automático em valores críticos
- Ordenação por coluna (clique no cabeçalho)
- Contadores OK / WARN / CRIT no header
- Timestamp de última sincronização
- Compatível com qualquer datasource que retorne uma DataFrame com as colunas esperadas

---

## ✦ Preview

![Neon Server Monitor](preview.png)

---

## ✦ Estrutura do Repositório

```
.
├── panel.html       # Estrutura HTML do painel
├── panel.css        # Estilos neon (variáveis, chips, barras, animações)
├── panel.js         # Lógica de leitura de dados, render e ordenação
└── README.md
```

---

## ✦ Configuração no Grafana

### 1. Instalar o plugin

```bash
grafana-cli plugins install gapit-htmlgraphics-panel
```

Ou via `grafana.ini`:
```ini
[plugins]
allow_loading_unsigned_plugins = gapit-htmlgraphics-panel
```

### 2. Datasource — colunas esperadas

O painel lê a **primeira série** (`data.series[0]`) e espera os seguintes campos:

| Campo      | Tipo    | Descrição                        |
|------------|---------|----------------------------------|
| `Servidor` | string  | Nome/hostname do servidor        |
| `Status`   | number  | `1` = UP, qualquer outro = DOWN  |
| `CPU`      | number  | Uso de CPU em % (0–100)          |
| `Memoria`  | number  | Uso de memória em % (0–100)      |
| `Disco`    | number  | Uso de disco em % (0–100)        |
| `Uptime`   | number  | Uptime em **segundos**           |

> Exemplo com Prometheus/Node Exporter: transforme as métricas via **Transformations → Merge + Organize fields** para gerar a DataFrame no formato acima.

### 3. Configurar o panel

No editor do painel HTML Graphics:

- **HTML/SVG document** → cole o conteúdo de `panel.html`
- **CSS** → cole o conteúdo de `panel.css`
- **JavaScript** → cole o conteúdo de `panel.js`
- Ative **"Run onRender"** para atualizar a cada refresh

---

## ✦ Thresholds

Os thresholds estão definidos no topo de `panel.js` e podem ser ajustados:

```js
const THRESHOLDS = {
  ok:   60,   // ≥ 60% → amarelo
  warn: 75,   // ≥ 75% → laranja
  crit: 80,   // ≥ 80% → vermelho (+ blink)
};
```

| Faixa        | Cor      | Comportamento            |
|--------------|----------|--------------------------|
| < 60%        | 🟢 Verde  | Normal                   |
| 60% – 74%    | 🟡 Amarelo| Atenção                  |
| 75% – 79%    | 🟠 Laranja| Alerta                   |
| ≥ 80%        | 🔴 Vermelho| Crítico + blink animado |

---

## ✦ Ordenação

Clique em qualquer cabeçalho de coluna para ordenar:

- **Servidor** — alfabético
- **Status** — UP primeiro / DOWN primeiro
- **CPU / Memória / Disco** — numérico crescente/decrescente
- **Uptime** — numérico crescente/decrescente

O estado de ordenação persiste durante a sessão via `window.__neon_state__`.

---

## ✦ Paleta de Cores

| Variável       | Valor     | Uso                          |
|----------------|-----------|------------------------------|
| `--cyan`       | `#00f5ff` | Títulos, glow primário       |
| `--green`      | `#39ff14` | Status OK, métricas normais  |
| `--yellow`     | `#ffea00` | Atenção                      |
| `--orange`     | `#ff6d00` | Alerta intermediário         |
| `--red`        | `#ff003c` | Crítico                      |
| `--bg`         | `#050810` | Fundo principal              |
| `--bg2`        | `#090d1a` | Fundo das linhas             |

Fontes: [Orbitron](https://fonts.google.com/specimen/Orbitron) (títulos) + [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) (dados).

---

## ✦ Personalização Rápida

**Mudar o título do painel:** edite no HTML:
```html
<div class="neon-header__title">Servidores Críticos</div>
```

**Adicionar mais colunas:** inclua o campo na lista `need` dentro de `toRows()` no JS e adicione a célula correspondente no render.

**Desativar scanlines:** remova ou comente o bloco `.neon-root::before` no CSS.

---

## ✦ Requisitos

- Grafana **8.x+**
- Plugin **gapit-htmlgraphics-panel** v0.1.0+
- Datasource com suporte a DataFrame (Prometheus, InfluxDB, MySQL, etc.)

---

## ✦ Licença

MIT — use, modifique e distribua livremente.
