# ⬡ Neon Server Monitor — Grafana HTML Graphics Panel

> Dashboard estilo **cyberpunk/neon** para monitoramento de servidores em tempo real, construído com o plugin [Grafana HTML Graphics](https://github.com/gapitio/gapit-htmlgraphics-panel).

<img width="900" height="450" alt="Demomapasvg" src="https://github.com/thyagohyvo/Table-server-monitor-grafana/blob/main/Neon%20Server%20Monitor%20Grafana%20HTML%20Graphics%20Panel.gif" />
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

---

## ✦ Query SQL (Zabbix + MySQL)

O datasource utilizado é o banco MySQL do **Zabbix**. A query abaixo consulta diretamente as tabelas internas do Zabbix e retorna uma linha por host com todas as métricas necessárias para o painel.

```sql
SELECT
    h.name AS Servidor,

    -- Status (Zabbix agent)
    (
        SELECT hu.value
        FROM history_uint hu
        WHERE hu.itemid = iagent.itemid
        ORDER BY hu.clock DESC
        LIMIT 1
    ) AS Status,

    -- CPU (%)
    (
        SELECT hv.value
        FROM history hv
        WHERE hv.itemid = icpu.itemid
        ORDER BY hv.clock DESC
        LIMIT 1
    ) AS CPU,

    -- Memory (%)
    (
        SELECT hv.value
        FROM history hv
        WHERE hv.itemid = imem.itemid
        ORDER BY hv.clock DESC
        LIMIT 1
    ) AS Memoria,

    -- Disk (%)
    (
        SELECT hv.value
        FROM history hv
        WHERE hv.itemid = idisk.itemid
        ORDER BY hv.clock DESC
        LIMIT 1
    ) AS Disco,

    -- Uptime
    (
        SELECT hu.value
        FROM history_uint hu
        WHERE hu.itemid = iuptime.itemid
        ORDER BY hu.clock DESC
        LIMIT 1
    ) AS Uptime

FROM hosts h
JOIN hosts_groups hg ON hg.hostid = h.hostid
JOIN hstgrp g ON g.groupid = hg.groupid

-- CPU
LEFT JOIN items icpu
  ON icpu.hostid = h.hostid
 AND icpu.key_ = 'system.cpu.util'

-- Memory
LEFT JOIN items imem
  ON imem.hostid = h.hostid
 AND imem.key_ = 'vm.memory.utilization'

-- Disk (root)
LEFT JOIN items idisk
  ON idisk.hostid = h.hostid
 AND idisk.key_ = 'vfs.fs.size[/,pused]'

-- Agent
LEFT JOIN items iagent
  ON iagent.hostid = h.hostid
 AND iagent.key_ = 'agent.ping'

-- Uptime
LEFT JOIN items iuptime
  ON iuptime.hostid = h.hostid
 AND iuptime.key_ = 'system.uptime'

WHERE g.name = 'GRUPO-DE-HOSTS'
  AND h.status = 0

ORDER BY h.name;
```

### Como funciona

A query é construída em duas camadas: o `FROM` principal seleciona os hosts, e as subqueries correlacionadas buscam o **valor mais recente** de cada métrica no histórico.

**Tabelas envolvidas:**

| Tabela | Papel |
|---|---|
| `hosts` | Cadastro de todos os hosts monitorados |
| `hosts_groups` / `hstgrp` | Relacionamento host ↔ grupo |
| `items` | Catálogo de itens (métricas) por host e `key_` |
| `history` | Histórico de métricas do tipo `float` (CPU, memória, disco) |
| `history_uint` | Histórico de métricas do tipo `unsigned int` (status, uptime) |

**JOINs — resolução dos `itemid`:**

Cada `LEFT JOIN` na tabela `items` localiza o `itemid` de uma métrica específica para o host, filtrando pela `key_` do Zabbix:

| Alias | `key_` | Métrica |
|---|---|---|
| `icpu` | `system.cpu.util` | Uso de CPU em % |
| `imem` | `vm.memory.utilization` | Uso de memória em % |
| `idisk` | `vfs.fs.size[/,pused]` | Uso do disco raiz em % |
| `iagent` | `agent.ping` | Disponibilidade do agente (1 = UP) |
| `iuptime` | `system.uptime` | Uptime em segundos |

**Subqueries correlacionadas:**

Para cada métrica, uma subquery busca o registro mais recente no histórico ordenando por `clock DESC` e limitando a 1 linha — equivalente a um `LAST()`. Isso garante que o painel sempre exiba o estado atual sem precisar de agregações por janela de tempo.

```sql
SELECT hv.value
FROM history hv
WHERE hv.itemid = icpu.itemid  -- correlaciona com o JOIN do host
ORDER BY hv.clock DESC
LIMIT 1
```

**Filtros no `WHERE`:**

```sql
WHERE g.name = 'GRUPO-DE-HOSTS'  -- filtra pelo grupo desejado no Zabbix
  AND h.status = 0               -- 0 = host ativo (1 = desativado)
```

> ⚠️ Substitua `'GRUPO-DE-HOSTS'` pelo nome exato do grupo configurado no seu Zabbix.

**Por que `LEFT JOIN` e não `INNER JOIN`?**

O `LEFT JOIN` garante que hosts sem uma métrica cadastrada (ex: item desabilitado ou ainda sem coleta) ainda apareçam na listagem — nesses casos o valor da coluna será `NULL`, exibido como `—` no painel.

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
