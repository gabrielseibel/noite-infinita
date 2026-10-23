# NOITE INFINITA — DEFESA FINAL

Tower defense de terror com cartas em tempo real, para navegador. Defenda o último abrigo contra hordas de monstros usando um baralho de 8 cartas (mão de 4), energia que regenera e decisões constantes.

## Como rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build de produção
npm test           # testes automatizados (Vitest)
npm run balance    # relatório de balanceamento: um bot joga todas as missões sem interface
```

Não precisa de servidor próprio, login ou serviços externos. Todos os recursos (arte, sons, fontes) são locais ou gerados no próprio navegador. O build em `dist/` pode ser hospedado em qualquer servidor estático.

Ferramentas de depuração: abra com `?debug=1` (ex.: `http://localhost:5173/?debug=1`) para ver alcances, colisões, campo de fluxo, caminhos A*, alvos, estados de IA, energia e temporizadores das ondas. A tecla `` ` `` liga/desliga a sobreposição.

## Controles

| Ação | Desktop | Toque |
|---|---|---|
| Selecionar carta | clique ou `1`–`4` | tocar na carta |
| Posicionar / lançar | clique na arena (ou arraste a carta) | tocar/arrastar na arena |
| Cancelar | botão direito ou `Esc` | botão "Cancelar" |
| Informações da unidade | clique na unidade | tocar na unidade |
| Zoom / câmera | roda do mouse / arrastar | pinça / arrastar |
| Pausar | `Espaço` ou botão Ⅱ | botão Ⅱ |
| Som | `M` | botão ♪ |
| Tela cheia | `F` | — |

Os atalhos são ignorados enquanto você digita em campos de texto. O jogo pausa sozinho quando a aba perde o foco.

## Conteúdo

- **16 cartas**: 6 sobreviventes, 4 criaturas, 4 estruturas e 2 habilidades, cada uma com um comportamento próprio (cura, reparo e barricadas da Engenheira, provocação do Veterano, investida do Cão, cerco do Golem, arco do Ceifador, lentidão UV, armadilha com usos, zona de fogo, atordoamento de luz…).
- **10 inimigos + crias**: Errante, Corredor, Bruto, Rastejante (passa por barricadas), Cuspidor (à distância), Parasita (caça unidades isoladas), Espectro (voa, atravessa defesas, metade do dano físico), Aranha Abissal (flanqueia e caça o suporte), Berrante (aura e reforços), Devorador (elite em área).
- **3 chefes** com ataques telegrafados: Açougueiro (golpe em área e depois fica vulnerável), Matriarca (invoca crias que a protegem) e Homem Sem Rosto (apaga as torres próximas e se teleporta até a unidade mais isolada).
- **6 eventos** que mudam o jogo: Apagão, Lua Vermelha, Chuva Torrencial, Névoa Densa, Grito Distante e Fuga do Abrigo (escolta).
- **10 missões de campanha** em 5 mapas e 10 temas, com objetivos de sobreviver e/ou destruir o ninho, mais 2 especiais: *Noite Sem Fim* (infinito) e *Desafio: Lua de Sangue*.
- **Progressão**: fragmentos, desbloqueio de cartas (pela campanha ou compra), 3 árvores de melhorias com pré-requisitos e limites, variantes visuais, missões especiais, estatísticas e bestiário.
- **Tutorial interativo** na primeira missão, com dicas na primeira aparição de cada inimigo.
- **Acessibilidade**: volumes separados de música e efeitos, efeitos reduzidos, menos flashes e tremores, alto contraste, ícones de estado com formatos distintos, números de dano opcionais, velocidade ×2.

## Arquitetura

```
src/
  app/        GameApp (orquestra Phaser + telas + save + áudio), config (nome do jogo e chaves globais)
  data/       todo o balanceamento: cards, units, enemies, bosses, maps, missions, events, upgrades, balance
  sim/        simulação pura (sem Phaser/DOM): BattleSim, energia, baralho, grade e pathfinding,
              combate, IA, chefes, ondas, eventos, hash espacial
  render/     arte procedural (Canvas 2D), texturas, cenário, views das entidades, efeitos, iluminação
  scenes/     BootScene, MenuScene (fundo animado), BattleScene (renderiza e controla a partida)
  systems/    SaveSystem, ProgressionSystem, AudioSystem (Web Audio), TutorialDirector
  ui/         HUD e telas em HTML/CSS
tests/        regras: energia, ciclo de cartas, dano/morte, ondas, vitória/derrota, baralho, save, progressão
scripts/      bots de balanceamento (npm run balance)
```

- A **simulação** é determinística (RNG com semente), roda em passo fixo de 1/60 s e emite eventos (`spawn`, `damage`, `death`, `slam`…) que a renderização transforma em animações, partículas e sons. Isso permite testar partidas inteiras sem navegador.
- **Navegação**: campos de fluxo (Dijkstra) por tipo de inimigo (terrestre, rasteiro, flanqueador) recalculados só quando estruturas mudam, mais A* com cache para perseguições. Estruturas têm custo no campo: os monstros contornam quando compensa ou atacam o que bloqueia o caminho.
- **Comportamentos** ficam em registros (`THINK`, `BEHAVIORS`, `BOSS_UPDATE`), dirigidos pelos dados, e não em condicionais gigantes.
- Pausa, ×2 e câmera lenta escalam o tempo da simulação, então temporizadores, animações e lógica continuam consistentes.

### Substituir a arte e o som

- Sprites: cada ator vira uma textura `actor_<id>` com quadros `idle`, `walk1`, `walk2` e `attack` (`src/render/textures.ts`). Basta carregar um spritesheet com a mesma chave e os mesmos quadros.
- Sons: `AudioSystem.samples[nome] = AudioBuffer` substitui o som sintetizado de mesmo nome (`pistol`, `slam`, `boss`…).

## Limites conhecidos

- Teto de 140 inimigos, 28 unidades, 14 estruturas e 220 projéteis simultâneos (`src/data/balance.ts`). O teste de desempenho com 140 entidades fica bem abaixo de 8 ms por passo de simulação.
- A arte é procedural (placeholder coerente, mas não é arte final).
- Em celular na vertical a arena é mostrada em parte e dá para arrastar; a experiência é melhor na horizontal.
- O balanceamento foi validado com bots (`npm run balance`); jogadores humanos ainda devem testar.
