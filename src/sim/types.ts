// Tipos centrais da simulação de batalha. A simulação é independente do Phaser:
// ela pode ser executada em testes (Node/jsdom) e é apenas observada pela renderização.

export type Team = 'player' | 'enemy' | 'neutral';

export type EntityKind =
  | 'unit' // unidades do jogador (sobreviventes e criaturas)
  | 'structure' // estruturas do jogador ou destroços neutros
  | 'trap'
  | 'enemy'
  | 'boss'
  | 'core' // núcleo do abrigo
  | 'nest' // ninho principal dos monstros
  | 'escort'; // sobrevivente em fuga (evento)

export type Tag =
  | 'elite'
  | 'supernatural'
  | 'flying'
  | 'low' // rasteja sob obstáculos baixos
  | 'boss'
  | 'heavy'
  | 'support'
  | 'ranged'
  | 'powered' // depende de energia elétrica (apagão desativa)
  | 'ethereal' // recebe dano reduzido de ataques físicos
  | 'lowObstacle' // barricada baixa: rastejantes passam por cima
  | 'blocker'; // bloqueia o caminho físico

export type TargetLayer = 'ground' | 'air' | 'both';
export type DamageType = 'physical' | 'fire' | 'light' | 'spectral' | 'poison';

export type StatusType =
  | 'slow'
  | 'stun'
  | 'burn'
  | 'poison'
  | 'enrage' // Lua Vermelha / Berrante
  | 'reinforced' // reduz dano recebido (Engenheira)
  | 'vulnerable' // recebe dano extra (Açougueiro após golpe pesado)
  | 'taunted' // forçado a atacar quem provocou
  | 'disabled'; // estrutura desligada

export interface StatusApply {
  type: StatusType;
  duration: number;
  power: number;
  /** Só aplica em alvos com esta tag. */
  onlyTag?: Tag;
}

export interface AttackDef {
  kind: 'melee' | 'projectile';
  damage: number;
  range: number;
  interval: number;
  /** Tempo de preparação antes do golpe acertar (respeita animação). */
  windup: number;
  targets: TargetLayer;
  damageType: DamageType;
  splash?: number;
  projectileSpeed?: number;
  projectileFx?: ProjectileFx;
  bonusVs?: Partial<Record<Tag, number>>;
  vsStructures?: number;
  onHit?: StatusApply[];
  /** Multiplicador do primeiro golpe (investida do Cão de Guerra). */
  firstHitMultiplier?: number;
  /** Chance de crítico (dano x1.75). */
  critChance?: number;
}

export type ProjectileFx = 'bullet' | 'pellet' | 'arrow' | 'acid' | 'uv' | 'feather' | 'spit';

export type AiId =
  | 'guard'
  | 'assault'
  | 'siege'
  | 'tower'
  | 'static'
  | 'trap'
  | 'walker'
  | 'ranged'
  | 'parasite'
  | 'flanker'
  | 'screamer'
  | 'butcher'
  | 'matriarch'
  | 'faceless'
  | 'escort'
  | 'nest';

export type BehaviorDef =
  | { type: 'heal'; radius: number; amount: number; interval: number; maxTargets: number }
  | { type: 'repair'; radius: number; amount: number; interval: number }
  | { type: 'buildBarricade'; interval: number; maxAlive: number; actor: string }
  | { type: 'taunt'; radius: number; interval: number; duration: number }
  | { type: 'aura'; radius: number; damageMult: number; speedMult: number }
  | { type: 'summon'; actor: string; count: number; interval: number; windup: number; maxAlive: number }
  | { type: 'slowAura'; radius: number; power: number }
  | { type: 'deathBurst'; radius: number; damage: number; damageType: DamageType; status?: StatusApply }
  | { type: 'deathEnergy'; amount: number };

export interface ActorDef {
  id: string;
  name: string;
  kind: EntityKind;
  hp: number;
  radius: number;
  speed: number;
  /** Fração de dano físico mitigado (0..0.8). */
  armor?: number;
  tags: Tag[];
  attack?: AttackDef;
  ai: AiId;
  aggroRange: number;
  behaviors?: BehaviorDef[];
  /** Tempo de vida (estruturas temporárias). */
  lifetime?: number;
  /** Cargas (armadilhas). */
  charges?: number;
  /** Fragmentos concedidos ao morrer (inimigos). */
  bounty?: number;
  /** Texto curto usado na ficha da unidade e no bestiário. */
  blurb: string;
}

export type CardCategory = 'survivor' | 'creature' | 'structure' | 'ability';
export type Rarity = 'common' | 'rare' | 'epic';

export type AbilityDef =
  | {
      type: 'fireZone';
      radius: number;
      duration: number;
      dps: number;
      tick: number;
    }
  | {
      type: 'lightBurst';
      radius: number;
      damage: number;
      supernaturalMult: number;
      stun: number;
    };

export type Placement = 'deploy' | 'deployPath' | 'anywhere';

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  cost: number;
  rarity: Rarity;
  description: string;
  actor?: string;
  count?: number;
  ability?: AbilityDef;
  /** Recarga em segundos após o uso (aplicada quando volta para a mão). */
  cooldown?: number;
  placement: Placement;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Status {
  type: StatusType;
  remaining: number;
  power: number;
  sourceId?: number;
  tick?: number;
}

export type AiState = 'idle' | 'move' | 'chase' | 'windup' | 'recover' | 'stunned' | 'channel' | 'dead';

export interface Entity {
  id: number;
  def: ActorDef;
  team: Team;
  kind: EntityKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  /** Tempo desde que surgiu. */
  age: number;
  /** Atraso de entrada (animação de surgimento). Não age enquanto > 0. */
  spawnDelay: number;
  state: AiState;
  targetId: number;
  attackCd: number;
  windupLeft: number;
  windupTargetId: number;
  hitsDone: number;
  statuses: Status[];
  aiTimer: number;
  behaviorTimers: number[];
  /** Ponto de guarda (unidades defensoras). */
  homeX: number;
  homeY: number;
  path: Vec[] | null;
  pathTimer: number;
  pathGoalCell: number;
  facing: number; // -1 esquerda, 1 direita
  elite: boolean;
  damageMult: number;
  speedMult: number;
  rangeMult: number;
  healMult: number;
  /** Multiplicador de vida aplicado na criação (para relatórios). */
  hpMult: number;
  charges: number;
  lifetime: number;
  ownerId: number;
  /** Uso livre de comportamentos especiais (chefes). */
  special: Record<string, number>;
  /** Último atacante, para estatísticas e IA. */
  lastHitBy: number;
  cardId?: string;
}

export interface FireZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  remaining: number;
  dps: number;
  tick: number;
  tickTimer: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  sourceId: number;
  targetId: number;
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  attack: AttackDef;
  team: Team;
  fx: ProjectileFx;
  alive: boolean;
  crit: boolean;
}

export interface Telegraph {
  id: number;
  x: number;
  y: number;
  radius: number;
  remaining: number;
  total: number;
  kind: 'slam' | 'summon' | 'teleport' | 'spawn';
}

export type BattleEvent =
  | { type: 'spawn'; entity: Entity }
  | { type: 'death'; entity: Entity; killerId: number }
  | { type: 'damage'; entity: Entity; amount: number; crit: boolean; damageType: DamageType; sourceId: number }
  | { type: 'heal'; entity: Entity; amount: number }
  | { type: 'attack'; entity: Entity; targetId: number; tx: number; ty: number }
  | { type: 'windup'; entity: Entity; duration: number }
  | { type: 'projectile'; projectile: Projectile }
  | { type: 'projectileHit'; projectile: Projectile }
  | { type: 'status'; entity: Entity; status: StatusType }
  | { type: 'fireZone'; zone: FireZone }
  | { type: 'lightBurst'; x: number; y: number; radius: number }
  | { type: 'trapTrigger'; entity: Entity }
  | { type: 'telegraph'; telegraph: Telegraph }
  | { type: 'slam'; entity: Entity; x: number; y: number; radius: number }
  | { type: 'teleport'; entity: Entity; fromX: number; fromY: number }
  | { type: 'summon'; entity: Entity }
  | { type: 'scream'; entity: Entity }
  | { type: 'taunt'; entity: Entity; radius: number }
  | { type: 'build'; entity: Entity }
  | { type: 'cardPlayed'; cardId: string; x: number; y: number }
  | { type: 'wave'; index: number; label: string; boss: boolean }
  | { type: 'bossIncoming'; bossId: string; name: string }
  | { type: 'eventStart'; eventId: string; name: string; description: string }
  | { type: 'eventEnd'; eventId: string }
  | { type: 'coreThreat' }
  | { type: 'escortSaved' }
  | { type: 'escortLost' }
  | { type: 'finalPhase' }
  | { type: 'nestRage'; level: number }
  | { type: 'gameOver'; result: BattleResult };

export interface BattleStats {
  kills: Record<string, number>;
  cardsPlayed: Record<string, number>;
  damageDealt: number;
  damageTaken: number;
  energySpent: number;
  bossesKilled: string[];
  unitsLost: number;
  structuresBuilt: number;
  wavesCleared: number;
  bounty: number;
}

export interface BattleResult {
  victory: boolean;
  reason: 'destroy' | 'survive' | 'coreDestroyed' | 'timeout';
  time: number;
  stats: BattleStats;
  coreHpPct: number;
  stars: number;
}
