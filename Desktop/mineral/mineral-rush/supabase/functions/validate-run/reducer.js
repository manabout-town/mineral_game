// src/shared/ids.ts
var asMineralId = (s) => s;
var asPickaxeId = (s) => s;
var asCardId = (s) => s;
var asSkillNodeId = (s) => s;
var asStageId = (s) => s;

// src/shared/constants.ts
var TICK_RATE_HZ = 60;
var FIXED_DELTA_MS = 1e3 / TICK_RATE_HZ;
var MAX_REPLAY_EVENTS = 5e3;

// src/shared/SeededRandom.ts
var Mulberry32 = class {
  state;
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    let t = this.state += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  nextInt(maxExclusive) {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
  pick(arr) {
    if (arr.length === 0) throw new Error("Mulberry32.pick on empty array");
    return arr[this.nextInt(arr.length)];
  }
  /** 가중치 기반 추첨. weights는 양수여야 함. 0이면 절대 안 뽑힘. */
  pickWeighted(items, weights) {
    if (items.length !== weights.length) throw new Error("items/weights length mismatch");
    if (items.length === 0) throw new Error("Mulberry32.pickWeighted on empty");
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) throw new Error("Mulberry32.pickWeighted: all weights zero");
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  /** 현재 state를 직렬화 (저장/리플레이용) */
  getState() {
    return this.state;
  }
  /** state 복원 */
  setState(s) {
    this.state = s >>> 0;
  }
};

// src/core/content/Content.ts
var ContentImpl = class {
  minerals;
  pickaxes;
  cards;
  stages;
  constructor(src) {
    this.minerals = new Map(
      src.minerals.minerals.map((m) => [
        asMineralId(m.id),
        { ...m, id: asMineralId(m.id) }
      ])
    );
    this.pickaxes = new Map(
      src.pickaxes.pickaxes.map((p) => [
        asPickaxeId(p.id),
        { ...p, id: asPickaxeId(p.id) }
      ])
    );
    this.cards = new Map(
      src.cards.cards.map((c) => [
        asCardId(c.id),
        { ...c, id: asCardId(c.id) }
      ])
    );
    this.stages = new Map(
      src.stages.stages.map((s) => [
        asStageId(s.id),
        { ...s, id: asStageId(s.id) }
      ])
    );
  }
  mineralsByDepth(depth) {
    const result = [];
    for (const m of this.minerals.values()) {
      if (depth >= m.depthMin && depth <= m.depthMax) result.push(m);
    }
    return result;
  }
  cardsByRarity(rarity) {
    const result = [];
    for (const c of this.cards.values()) {
      if (c.rarity === rarity) result.push(c);
    }
    return result;
  }
};
function buildContent(src) {
  validate(src);
  return new ContentImpl(src);
}
function validate(src) {
  const mineralIds = /* @__PURE__ */ new Set();
  for (const m of src.minerals.minerals) {
    if (mineralIds.has(m.id)) throw new Error(`Duplicate mineral id: ${m.id}`);
    mineralIds.add(m.id);
    if (m.depthMin > m.depthMax) throw new Error(`Mineral ${m.id}: depthMin > depthMax`);
    if (m.dropWeight < 0) throw new Error(`Mineral ${m.id}: negative dropWeight`);
    if (m.baseValue < 0) throw new Error(`Mineral ${m.id}: negative baseValue`);
  }
  const pickaxeIds = /* @__PURE__ */ new Set();
  for (const p of src.pickaxes.pickaxes) {
    if (pickaxeIds.has(p.id)) throw new Error(`Duplicate pickaxe id: ${p.id}`);
    pickaxeIds.add(p.id);
    if (p.damage <= 0) throw new Error(`Pickaxe ${p.id}: non-positive damage`);
    if (p.speed <= 0) throw new Error(`Pickaxe ${p.id}: non-positive speed`);
  }
  const cardIds = /* @__PURE__ */ new Set();
  for (const c of src.cards.cards) {
    if (cardIds.has(c.id)) throw new Error(`Duplicate card id: ${c.id}`);
    cardIds.add(c.id);
    if (!Number.isFinite(c.magnitude)) throw new Error(`Card ${c.id}: invalid magnitude`);
  }
  const stageIds = /* @__PURE__ */ new Set();
  for (const s of src.stages.stages) {
    if (stageIds.has(s.id)) throw new Error(`Duplicate stage id: ${s.id}`);
    stageIds.add(s.id);
    if (s.depthRange[0] > s.depthRange[1]) throw new Error(`Stage ${s.id}: depthRange invalid`);
    if (s.veinHpBase <= 0) throw new Error(`Stage ${s.id}: non-positive veinHpBase`);
    if (s.veinHpPerDepth < 1) throw new Error(`Stage ${s.id}: veinHpPerDepth must be >= 1`);
  }
}

// data/minerals.json
var minerals_default = {
  $schema: "../src/core/content/schemas/mineral.schema.json",
  minerals: [
    {
      id: "copper",
      name: { ko: "\uAD6C\uB9AC", en: "Copper" },
      rarity: "common",
      baseValue: 1,
      color: "#b87333",
      depthMin: 1,
      depthMax: 99,
      dropWeight: 100
    },
    {
      id: "iron",
      name: { ko: "\uCCA0", en: "Iron" },
      rarity: "common",
      baseValue: 3,
      color: "#a7a7a7",
      depthMin: 1,
      depthMax: 99,
      dropWeight: 60
    },
    {
      id: "silver",
      name: { ko: "\uC740", en: "Silver" },
      rarity: "uncommon",
      baseValue: 6,
      color: "#cfcfcf",
      depthMin: 2,
      depthMax: 99,
      dropWeight: 28
    },
    {
      id: "gold",
      name: { ko: "\uAE08", en: "Gold" },
      rarity: "uncommon",
      baseValue: 12,
      color: "#ffd700",
      depthMin: 2,
      depthMax: 99,
      dropWeight: 12
    },
    {
      id: "ruby",
      name: { ko: "\uB8E8\uBE44", en: "Ruby" },
      rarity: "rare",
      baseValue: 28,
      color: "#e0115f",
      depthMin: 4,
      depthMax: 99,
      dropWeight: 6
    },
    {
      id: "sapphire",
      name: { ko: "\uC0AC\uD30C\uC774\uC5B4", en: "Sapphire" },
      rarity: "rare",
      baseValue: 30,
      color: "#0f52ba",
      depthMin: 5,
      depthMax: 99,
      dropWeight: 5
    },
    {
      id: "emerald",
      name: { ko: "\uC5D0\uBA54\uB784\uB4DC", en: "Emerald" },
      rarity: "rare",
      baseValue: 36,
      color: "#50c878",
      depthMin: 6,
      depthMax: 99,
      dropWeight: 4
    },
    {
      id: "diamond",
      name: { ko: "\uB2E4\uC774\uC544\uBAAC\uB4DC", en: "Diamond" },
      rarity: "epic",
      baseValue: 90,
      color: "#b9f2ff",
      depthMin: 8,
      depthMax: 99,
      dropWeight: 2.5
    },
    {
      id: "obsidian",
      name: { ko: "\uD751\uC694\uC11D", en: "Obsidian" },
      rarity: "epic",
      baseValue: 120,
      color: "#3d2c4d",
      depthMin: 10,
      depthMax: 99,
      dropWeight: 1.6
    },
    {
      id: "mithril",
      name: { ko: "\uBBF8\uC2A4\uB9B4", en: "Mithril" },
      rarity: "legendary",
      baseValue: 320,
      color: "#9ad9ea",
      depthMin: 14,
      depthMax: 99,
      dropWeight: 0.8
    },
    {
      id: "adamantite",
      name: { ko: "\uC544\uB2E4\uB9CC\uD0C0\uC774\uD2B8", en: "Adamantite" },
      rarity: "legendary",
      baseValue: 540,
      color: "#7e1f1f",
      depthMin: 18,
      depthMax: 99,
      dropWeight: 0.4
    },
    {
      id: "orichalcum",
      name: { ko: "\uC624\uB9AC\uD558\uB974\uCF58", en: "Orichalcum" },
      rarity: "legendary",
      baseValue: 1200,
      color: "#f6c84c",
      depthMin: 22,
      depthMax: 99,
      dropWeight: 0.15
    }
  ]
};

// data/pickaxes.json
var pickaxes_default = {
  pickaxes: [
    {
      id: "basic_pickaxe",
      name: { ko: "\uAE30\uBCF8 \uACE1\uAD2D\uC774", en: "Basic Pickaxe" },
      damage: 10,
      speed: 4,
      range: 50,
      comboBonus: 0.05,
      unlockCost: 0,
      description: { ko: "\uB0A1\uC558\uC9C0\uB9CC \uB4E0\uB4E0\uD55C \uCCAB \uB3C4\uAD6C.", en: "Worn but reliable starter tool." }
    },
    {
      id: "iron_pickaxe",
      name: { ko: "\uCCA0 \uACE1\uAD2D\uC774", en: "Iron Pickaxe" },
      damage: 18,
      speed: 5,
      range: 55,
      comboBonus: 0.06,
      unlockCost: 200,
      description: { ko: "\uB2E8\uB2E8\uD55C \uCCA0\uB85C \uBCBC\uB9B0 \uD45C\uC900 \uAD11\uBD80 \uC7A5\uBE44.", en: "Forged iron, the miner's standard." }
    },
    {
      id: "steel_pickaxe",
      name: { ko: "\uAC15\uCCA0 \uACE1\uAD2D\uC774", en: "Steel Pickaxe" },
      damage: 32,
      speed: 6,
      range: 58,
      comboBonus: 0.07,
      unlockCost: 800,
      description: { ko: "\uD0C4\uC18C\uB97C \uB354\uD55C \uD569\uAE08. \uB354 \uAE4A\uC774, \uB354 \uBE60\uB974\uAC8C.", en: "Carbon-alloyed for depth and speed." }
    },
    {
      id: "ruby_pickaxe",
      name: { ko: "\uB8E8\uBE44 \uACE1\uAD2D\uC774", en: "Ruby Pickaxe" },
      damage: 52,
      speed: 6,
      range: 60,
      comboBonus: 0.09,
      unlockCost: 2400,
      description: { ko: "\uB8E8\uBE44 \uD5E4\uB4DC\uAC00 \uAD11\uBB3C\uC758 \uACB0\uC744 \uD30C\uACE0\uB4E0\uB2E4.", en: "Ruby head bites along the grain." }
    },
    {
      id: "diamond_pickaxe",
      name: { ko: "\uB2E4\uC774\uC544 \uACE1\uAD2D\uC774", en: "Diamond Pickaxe" },
      damage: 88,
      speed: 7,
      range: 64,
      comboBonus: 0.11,
      unlockCost: 7200,
      description: { ko: "\uB2E4\uC774\uC544\uBAAC\uB4DC \uAC00\uACF5 \uCE7C\uB0A0. \uAC70\uC758 \uBAA8\uB4E0 \uAD11\uB9E5\uC744 \uD30C\uB0B8\uB2E4.", en: "Diamond edge \u2014 splits nearly any vein." }
    },
    {
      id: "obsidian_pickaxe",
      name: { ko: "\uD751\uC694\uC11D \uACE1\uAD2D\uC774", en: "Obsidian Pickaxe" },
      damage: 138,
      speed: 7,
      range: 66,
      comboBonus: 0.13,
      unlockCost: 18e3,
      description: { ko: "\uB9C8\uADF8\uB9C8\uCE35\uC5D0\uC11C \uB2E8\uC870\uB41C \uC758\uC2DD\uC6A9 \uACE1\uAD2D\uC774.", en: "Forged in magma \u2014 ceremonial weight." }
    },
    {
      id: "mithril_pickaxe",
      name: { ko: "\uBBF8\uC2A4\uB9B4 \uACE1\uAD2D\uC774", en: "Mithril Pickaxe" },
      damage: 210,
      speed: 8,
      range: 70,
      comboBonus: 0.16,
      unlockCost: 5e4,
      description: { ko: "\uD55C\uC5C6\uC774 \uAC00\uBCCD\uACE0, \uD55C\uC5C6\uC774 \uB2E8\uB2E8\uD55C.", en: "Light as a feather, hard as legend." }
    },
    {
      id: "orichalcum_pickaxe",
      name: { ko: "\uC624\uB9AC\uD558\uB974\uCF58 \uACE1\uAD2D\uC774", en: "Orichalcum Pickaxe" },
      damage: 360,
      speed: 9,
      range: 76,
      comboBonus: 0.2,
      unlockCost: 2e5,
      description: { ko: "\uC804\uC124\uC758 \uC815\uC810. \uCF54\uC5B4\uCE35 \uAD11\uB9E5\uB3C4 \uAE68\uB728\uB9B0\uB2E4.", en: "Legendary. Cracks even the core vein." }
    }
  ]
};

// data/cards.json
var cards_default = {
  cards: [
    {
      id: "sharp_edge",
      name: { ko: "\uC608\uB9AC\uD55C \uB0A0", en: "Sharp Edge" },
      rarity: "common",
      effect: "damage_mul",
      magnitude: 0.15,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +15%", en: "Pickaxe damage +15%" }
    },
    {
      id: "tempered_head",
      name: { ko: "\uB2E8\uC870\uB41C \uD5E4\uB4DC", en: "Tempered Head" },
      rarity: "common",
      effect: "damage_mul",
      magnitude: 0.18,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +18%", en: "Pickaxe damage +18%" }
    },
    {
      id: "calloused_grip",
      name: { ko: "\uAD73\uC740\uC0B4 \uADF8\uB9BD", en: "Calloused Grip" },
      rarity: "common",
      effect: "damage_mul",
      magnitude: 0.12,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +12%", en: "Pickaxe damage +12%" }
    },
    {
      id: "steady_hands",
      name: { ko: "\uC548\uC815\uB41C \uC190", en: "Steady Hands" },
      rarity: "common",
      effect: "combo_window_ms",
      magnitude: 300,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +300ms", en: "Combo window +300ms" }
    },
    {
      id: "rhythm_keeper",
      name: { ko: "\uBC15\uC790 \uC720\uC9C0\uC790", en: "Rhythm Keeper" },
      rarity: "common",
      effect: "combo_window_ms",
      magnitude: 400,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +400ms", en: "Combo window +400ms" }
    },
    {
      id: "appraiser_eye",
      name: { ko: "\uAC10\uC815\uC0AC\uC758 \uB208", en: "Appraiser's Eye" },
      rarity: "common",
      effect: "ore_value_mul",
      magnitude: 0.2,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +20%", en: "Ore value +20%" }
    },
    {
      id: "haggling_tongue",
      name: { ko: "\uD765\uC815\uC758 \uD600", en: "Haggling Tongue" },
      rarity: "common",
      effect: "ore_value_mul",
      magnitude: 0.15,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +15%", en: "Ore value +15%" }
    },
    {
      id: "lucky_strike",
      name: { ko: "\uD589\uC6B4\uC758 \uC77C\uACA9", en: "Lucky Strike" },
      rarity: "common",
      effect: "drop_rate_mul",
      magnitude: 0.25,
      description: { ko: "\uB4DC\uB78D\uB960 +25%", en: "Drop rate +25%" }
    },
    {
      id: "scavengers_charm",
      name: { ko: "\uB178\uD68D\uC790\uC758 \uBD80\uC801", en: "Scavenger's Charm" },
      rarity: "common",
      effect: "drop_rate_mul",
      magnitude: 0.18,
      description: { ko: "\uB4DC\uB78D\uB960 +18%", en: "Drop rate +18%" }
    },
    {
      id: "warmup",
      name: { ko: "\uC900\uBE44\uC6B4\uB3D9", en: "Warm-up" },
      rarity: "common",
      effect: "combo_max_bonus",
      magnitude: 0.01,
      description: { ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +1%", en: "Damage +1% per combo stack" }
    },
    {
      id: "deep_breath",
      name: { ko: "\uC2EC\uD638\uD761", en: "Deep Breath" },
      rarity: "rare",
      effect: "damage_mul",
      magnitude: 0.4,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +40%", en: "Pickaxe damage +40%" }
    },
    {
      id: "ancestral_strength",
      name: { ko: "\uC120\uC870\uC758 \uD798", en: "Ancestral Strength" },
      rarity: "rare",
      effect: "damage_mul",
      magnitude: 0.45,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +45%", en: "Pickaxe damage +45%" }
    },
    {
      id: "miners_focus",
      name: { ko: "\uAD11\uBD80\uC758 \uC9D1\uC911", en: "Miner's Focus" },
      rarity: "rare",
      effect: "combo_max_bonus",
      magnitude: 0.02,
      description: {
        ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +2%",
        en: "Damage +2% per combo stack"
      }
    },
    {
      id: "metronome",
      name: { ko: "\uBA54\uD2B8\uB85C\uB188", en: "Metronome" },
      rarity: "rare",
      effect: "combo_window_ms",
      magnitude: 800,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +800ms", en: "Combo window +800ms" }
    },
    {
      id: "gold_tooth",
      name: { ko: "\uD669\uAE08 \uC5B4\uAE08\uB2C8", en: "Gold Tooth" },
      rarity: "rare",
      effect: "ore_value_mul",
      magnitude: 0.4,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +40%", en: "Ore value +40%" }
    },
    {
      id: "magnetic_glove",
      name: { ko: "\uC790\uC131 \uC7A5\uAC11", en: "Magnetic Glove" },
      rarity: "rare",
      effect: "drop_rate_mul",
      magnitude: 0.45,
      description: { ko: "\uB4DC\uB78D\uB960 +45%", en: "Drop rate +45%" }
    },
    {
      id: "second_wind",
      name: { ko: "\uB450 \uBC88\uC9F8 \uD638\uD761", en: "Second Wind" },
      rarity: "rare",
      effect: "combo_window_ms",
      magnitude: 600,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +600ms", en: "Combo window +600ms" }
    },
    {
      id: "berserker_call",
      name: { ko: "\uAD11\uC804\uC0AC\uC758 \uBD80\uB984", en: "Berserker's Call" },
      rarity: "epic",
      effect: "damage_mul",
      magnitude: 0.85,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +85%", en: "Pickaxe damage +85%" }
    },
    {
      id: "perfect_swing",
      name: { ko: "\uC644\uBCBD\uD55C \uC2A4\uC719", en: "Perfect Swing" },
      rarity: "epic",
      effect: "combo_max_bonus",
      magnitude: 0.04,
      description: {
        ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +4%",
        en: "Damage +4% per combo stack"
      }
    },
    {
      id: "midas_chisel",
      name: { ko: "\uBBF8\uB2E4\uC2A4\uC758 \uC815", en: "Midas Chisel" },
      rarity: "epic",
      effect: "ore_value_mul",
      magnitude: 0.85,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +85%", en: "Ore value +85%" }
    },
    {
      id: "veinseeker",
      name: { ko: "\uAD11\uB9E5 \uD0D0\uC9C0\uAE30", en: "Veinseeker" },
      rarity: "epic",
      effect: "drop_rate_mul",
      magnitude: 0.8,
      description: { ko: "\uB4DC\uB78D\uB960 +80%", en: "Drop rate +80%" }
    },
    {
      id: "long_breath",
      name: { ko: "\uAE34 \uC228", en: "Long Breath" },
      rarity: "epic",
      effect: "combo_window_ms",
      magnitude: 1200,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +1200ms", en: "Combo window +1200ms" }
    },
    {
      id: "wild_swing",
      name: { ko: "\uAC70\uCE5C \uC2A4\uC719", en: "Wild Swing" },
      rarity: "epic",
      effect: "damage_mul",
      magnitude: 1,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +100%", en: "Pickaxe damage +100%" }
    },
    {
      id: "earth_crusher",
      name: { ko: "\uB300\uC9C0 \uBD84\uC1C4\uC790", en: "Earth Crusher" },
      rarity: "legendary",
      effect: "damage_mul",
      magnitude: 1.8,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +180%", en: "Pickaxe damage +180%" }
    },
    {
      id: "tempo_god",
      name: { ko: "\uBC15\uC790\uC758 \uC2E0", en: "Tempo God" },
      rarity: "legendary",
      effect: "combo_max_bonus",
      magnitude: 0.08,
      description: {
        ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +8%",
        en: "Damage +8% per combo stack"
      }
    },
    {
      id: "midas_touch",
      name: { ko: "\uBBF8\uB2E4\uC2A4\uC758 \uC190", en: "Midas Touch" },
      rarity: "legendary",
      effect: "ore_value_mul",
      magnitude: 1.6,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +160%", en: "Ore value +160%" }
    },
    {
      id: "vein_oracle",
      name: { ko: "\uAD11\uB9E5\uC758 \uC2E0\uD0C1", en: "Vein Oracle" },
      rarity: "legendary",
      effect: "drop_rate_mul",
      magnitude: 1.5,
      description: { ko: "\uB4DC\uB78D\uB960 +150%", en: "Drop rate +150%" }
    },
    {
      id: "infinite_swing",
      name: { ko: "\uBB34\uD55C \uC2A4\uC719", en: "Infinite Swing" },
      rarity: "legendary",
      effect: "combo_window_ms",
      magnitude: 2e3,
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +2000ms", en: "Combo window +2000ms" }
    },
    {
      id: "pickaxe_savant",
      name: { ko: "\uACE1\uAD2D\uC774 \uBA85\uC778", en: "Pickaxe Savant" },
      rarity: "rare",
      effect: "damage_mul",
      magnitude: 0.55,
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +55%", en: "Pickaxe damage +55%" }
    },
    {
      id: "loose_change",
      name: { ko: "\uC794\uB3C8 \uC90D\uAE30", en: "Loose Change" },
      rarity: "rare",
      effect: "ore_value_mul",
      magnitude: 0.32,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +32%", en: "Ore value +32%" }
    },
    {
      id: "smelters_kiss",
      name: { ko: "\uC81C\uB828\uACF5\uC758 \uD0A4\uC2A4", en: "Smelter's Kiss" },
      rarity: "epic",
      effect: "ore_value_mul",
      magnitude: 0.65,
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +65%", en: "Ore value +65%" }
    },
    {
      id: "double_pull",
      name: { ko: "\uB354\uBE14 \uD480", en: "Double Pull" },
      rarity: "rare",
      effect: "drop_rate_mul",
      magnitude: 0.6,
      description: { ko: "\uB4DC\uB78D\uB960 +60%", en: "Drop rate +60%" }
    }
  ]
};

// data/stages.json
var stages_default = {
  stages: [
    {
      id: "open_pit",
      name: { ko: "\uB178\uCC9C\uAD11", en: "Open Pit" },
      depthRange: [1, 5],
      biome: "surface",
      veinHpBase: 200,
      veinHpPerDepth: 1.4,
      description: { ko: "\uD587\uBCD5\uC774 \uB4DC\uB294 \uD45C\uCE35 \uAD11\uB9E5.", en: "Surface vein under daylight." }
    },
    {
      id: "cave",
      name: { ko: "\uB3D9\uAD74", en: "Cave" },
      depthRange: [6, 12],
      biome: "cave",
      veinHpBase: 720,
      veinHpPerDepth: 1.45,
      description: { ko: "\uC5B4\uB450\uC6B4 \uB3D9\uAD74 \u2014 \uBC15\uC950\uC640 \uAD11\uB9E5\uC774 \uACF5\uC874\uD55C\uB2E4.", en: "Dark caves \u2014 bats and veins together." }
    },
    {
      id: "deep_shaft",
      name: { ko: "\uC2EC\uCE35 \uAC31\uB3C4", en: "Deep Shaft" },
      depthRange: [13, 21],
      biome: "deep",
      veinHpBase: 3200,
      veinHpPerDepth: 1.5,
      description: { ko: "\uC9C0\uCE35\uC758 \uC555\uB825\uC774 \uB290\uAEF4\uC9C4\uB2E4. \uB354 \uD070 \uAD11\uB9E5 \u2192 \uB354 \uD070 \uBCF4\uC0C1.", en: "Crushing pressure. Bigger vein, bigger reward." }
    },
    {
      id: "magma_layer",
      name: { ko: "\uB9C8\uADF8\uB9C8 \uCE35", en: "Magma Layer" },
      depthRange: [22, 28],
      biome: "magma",
      veinHpBase: 14e3,
      veinHpPerDepth: 1.55,
      description: { ko: "\uC6A9\uC554\uC774 \uD750\uB974\uB294 \uB2E8\uC870\uC758 \uC790\uB9AC.", en: "Where lava forges everything." }
    },
    {
      id: "core",
      name: { ko: "\uCF54\uC5B4\uCE35", en: "Core" },
      depthRange: [29, 99],
      biome: "core",
      veinHpBase: 8e4,
      veinHpPerDepth: 1.6,
      description: { ko: "\uD589\uC131\uC758 \uC2EC\uC7A5. \uC804\uC124\uC758 \uAD11\uBB3C\uC774 \uC7A0\uB4E0 \uACF3.", en: "Planet's heart. Where legends sleep." }
    }
  ]
};

// src/core/content/index.ts
var sources = {
  minerals: minerals_default,
  pickaxes: pickaxes_default,
  cards: cards_default,
  stages: stages_default
};
var content = buildContent(sources);

// src/core/rules/damage.ts
function computeDamage(input) {
  const base = input.pickaxe.damage;
  const damageMul = Math.max(0, input.modifiers.damageMul);
  const comboFactor = 1 + Math.max(0, input.modifiers.comboMaxBonus) * Math.max(0, input.combo);
  const final = base * damageMul * comboFactor;
  return { base, damageMul, comboFactor, final };
}

// src/core/rules/veinHp.ts
function computeVeinHp(stage, depth, veinIndex) {
  const depthScale = Math.pow(stage.veinHpPerDepth, Math.max(0, depth - 1));
  const veinScale = 1 + veinIndex * 0.08;
  return Math.round(stage.veinHpBase * depthScale * veinScale);
}

// src/core/rules/dropTable.ts
function buildMineralPool(content2, depth) {
  const candidates = [...content2.mineralsByDepth(depth)];
  if (candidates.length === 0) return [];
  return candidates.map((m) => ({ mineralId: m.id, weight: m.dropWeight }));
}
function tryDrop(pool, content2, rng, baseDropChance, dropRateMul) {
  if (pool.length === 0) return null;
  const chance = Math.min(1, Math.max(0, baseDropChance * dropRateMul));
  if (rng.next() >= chance) return null;
  const items = pool.map((p) => p.mineralId);
  const weights = pool.map((p) => p.weight);
  const mineralId = rng.pickWeighted(items, weights);
  const amountRoll = rng.next();
  const amount = amountRoll < 0.7 ? 1 : amountRoll < 0.95 ? 2 : 3;
  const def = content2.minerals.get(mineralId);
  const unitValue = def?.baseValue ?? 1;
  return { mineralId, amount, unitValue };
}
var BASE_DROP_CHANCE = 0.35;

// src/core/rules/cardOffer.ts
var RARITIES = ["common", "rare", "epic", "legendary"];
var EARLY_WEIGHTS = { common: 60, rare: 30, epic: 9, legendary: 1 };
var LATE_WEIGHTS = { common: 30, rare: 40, epic: 25, legendary: 5 };
function interpolateWeights(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    common: EARLY_WEIGHTS.common + (LATE_WEIGHTS.common - EARLY_WEIGHTS.common) * p,
    rare: EARLY_WEIGHTS.rare + (LATE_WEIGHTS.rare - EARLY_WEIGHTS.rare) * p,
    epic: EARLY_WEIGHTS.epic + (LATE_WEIGHTS.epic - EARLY_WEIGHTS.epic) * p,
    legendary: EARLY_WEIGHTS.legendary + (LATE_WEIGHTS.legendary - EARLY_WEIGHTS.legendary) * p
  };
}
function progressFromVeinsDestroyed(veinsDestroyed) {
  return Math.max(0, Math.min(1, veinsDestroyed / 5));
}
function rollCardOffer(content2, rng, options) {
  const weights = interpolateWeights(options.progress);
  const offered = /* @__PURE__ */ new Set();
  const cards = [];
  for (let i = 0; i < options.count; i++) {
    const card = rollOne(content2, rng, weights, options.pickedCardIds, offered);
    if (!card) break;
    offered.add(card.cardId);
    cards.push(card);
  }
  return { cards, rerollCost: options.rerollCost };
}
function rollOne(content2, rng, weights, pickedCardIds, offered) {
  const rarityWeights = RARITIES.map((r) => weights[r]);
  let rarity;
  let pool;
  const tries = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    tries.push(rng.pickWeighted(RARITIES, rarityWeights));
  }
  rarity = tries[0];
  pool = content2.cardsByRarity(rarity);
  if (!pickableExists(pool, pickedCardIds, offered)) {
    for (const r of RARITIES) {
      const p = content2.cardsByRarity(r);
      if (pickableExists(p, pickedCardIds, offered)) {
        rarity = r;
        pool = p;
        break;
      }
    }
  }
  const candidates = pool.filter(
    (c) => !pickedCardIds.includes(c.id) && !offered.has(c.id)
  );
  if (candidates.length === 0) return null;
  const ids = candidates.map((c) => c.id);
  const ws = candidates.map(() => 1);
  const cardId = rng.pickWeighted(ids, ws);
  return { cardId, rarity };
}
function pickableExists(pool, pickedCardIds, offered) {
  return pool.some((c) => !pickedCardIds.includes(c.id) && !offered.has(c.id));
}
function applyCardEffect(current, effect, magnitude) {
  switch (effect) {
    case "damage_mul":
      return { ...current, damageMul: current.damageMul + magnitude };
    case "combo_window_ms":
      return { ...current, comboWindowMs: current.comboWindowMs + magnitude };
    case "ore_value_mul":
      return { ...current, oreValueMul: current.oreValueMul + magnitude };
    case "drop_rate_mul":
      return { ...current, dropRateMul: current.dropRateMul + magnitude };
    case "combo_max_bonus":
      return { ...current, comboMaxBonus: current.comboMaxBonus + magnitude };
    default: {
      const _exhaustive = effect;
      void _exhaustive;
      return current;
    }
  }
}

// src/core/State.ts
var DEFAULT_RUN_MODIFIERS = {
  damageMul: 1,
  comboWindowMs: 1500,
  oreValueMul: 1,
  dropRateMul: 1,
  comboMaxBonus: 0
};

// data/skill_nodes.json
var skill_nodes_default = {
  $comment: "Mineral Rush \uC2A4\uD0AC\uD2B8\uB9AC. 6\uAC1C \uBE0C\uB79C\uCE58 \u2014 pickaxe / ore_value / combo / drop / crystal / meta. position\uC740 \uD5A5\uD6C4 \uD2B8\uB9AC\uBDF0\uC758 \uC815\uADDC\uD654 \uC88C\uD45C (0~1).",
  nodes: [
    {
      id: "pickaxe_root",
      name: { ko: "\uACE1\uAD2D\uC774 \uC219\uB828", en: "Pickaxe Mastery" },
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +5% / \uB808\uBCA8", en: "Pickaxe damage +5% per level" },
      branch: "pickaxe",
      prerequisites: [],
      baseCost: 25,
      costMul: 1.6,
      maxLevel: 5,
      effect: { kind: "damage_mul", magnitudePerLevel: 0.05 },
      position: { x: 0.15, y: 0.2 }
    },
    {
      id: "pickaxe_sharper",
      name: { ko: "\uB354 \uB0A0\uCE74\uB86D\uAC8C", en: "Sharper Edge" },
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +8% / \uB808\uBCA8", en: "Pickaxe damage +8% per level" },
      branch: "pickaxe",
      prerequisites: ["pickaxe_root"],
      baseCost: 60,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "damage_mul", magnitudePerLevel: 0.08 },
      position: { x: 0.1, y: 0.32 }
    },
    {
      id: "pickaxe_heavy",
      name: { ko: "\uBB34\uAC70\uC6B4 \uD5E4\uB4DC", en: "Heavy Head" },
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +12% / \uB808\uBCA8", en: "Pickaxe damage +12% per level" },
      branch: "pickaxe",
      prerequisites: ["pickaxe_sharper"],
      baseCost: 180,
      costMul: 1.8,
      maxLevel: 5,
      effect: { kind: "damage_mul", magnitudePerLevel: 0.12 },
      position: { x: 0.05, y: 0.45 }
    },
    {
      id: "pickaxe_master",
      name: { ko: "\uAD11\uBD80\uC758 \uC815\uC218", en: "Miner's Essence" },
      description: { ko: "\uACE1\uAD2D\uC774 \uB370\uBBF8\uC9C0 +20% / \uB808\uBCA8", en: "Pickaxe damage +20% per level" },
      branch: "pickaxe",
      prerequisites: ["pickaxe_heavy"],
      baseCost: 720,
      costMul: 2,
      maxLevel: 3,
      effect: { kind: "damage_mul", magnitudePerLevel: 0.2 },
      position: { x: 0.05, y: 0.6 }
    },
    {
      id: "ore_value_root",
      name: { ko: "\uAC10\uC815", en: "Appraisal" },
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +5% / \uB808\uBCA8", en: "Ore value +5% per level" },
      branch: "ore_value",
      prerequisites: [],
      baseCost: 30,
      costMul: 1.6,
      maxLevel: 5,
      effect: { kind: "ore_value_mul", magnitudePerLevel: 0.05 },
      position: { x: 0.32, y: 0.2 }
    },
    {
      id: "ore_value_polish",
      name: { ko: "\uAD11\uD0DD\uB0B4\uAE30", en: "Polishing" },
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +8% / \uB808\uBCA8", en: "Ore value +8% per level" },
      branch: "ore_value",
      prerequisites: ["ore_value_root"],
      baseCost: 90,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "ore_value_mul", magnitudePerLevel: 0.08 },
      position: { x: 0.3, y: 0.32 }
    },
    {
      id: "ore_value_smelter",
      name: { ko: "\uC81C\uB828", en: "Smelting" },
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +12% / \uB808\uBCA8", en: "Ore value +12% per level" },
      branch: "ore_value",
      prerequisites: ["ore_value_polish"],
      baseCost: 240,
      costMul: 1.85,
      maxLevel: 5,
      effect: { kind: "ore_value_mul", magnitudePerLevel: 0.12 },
      position: { x: 0.32, y: 0.45 }
    },
    {
      id: "ore_value_grandmaster",
      name: { ko: "\uAC10\uC815 \uADF8\uB79C\uB4DC\uB9C8\uC2A4\uD130", en: "Appraisal Grandmaster" },
      description: { ko: "\uAD11\uC11D \uAC00\uCE58 +20% / \uB808\uBCA8", en: "Ore value +20% per level" },
      branch: "ore_value",
      prerequisites: ["ore_value_smelter"],
      baseCost: 1e3,
      costMul: 2,
      maxLevel: 3,
      effect: { kind: "ore_value_mul", magnitudePerLevel: 0.2 },
      position: { x: 0.34, y: 0.6 }
    },
    {
      id: "combo_root",
      name: { ko: "\uB9AC\uB4EC\uAC10", en: "Sense of Rhythm" },
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +200ms / \uB808\uBCA8", en: "Combo window +200ms per level" },
      branch: "combo",
      prerequisites: [],
      baseCost: 30,
      costMul: 1.6,
      maxLevel: 5,
      effect: { kind: "combo_window_ms", magnitudePerLevel: 200 },
      position: { x: 0.5, y: 0.2 }
    },
    {
      id: "combo_breath",
      name: { ko: "\uAE34 \uD638\uD761", en: "Long Breath" },
      description: { ko: "\uCF64\uBCF4 \uC720\uC9C0 \uC2DC\uAC04 +300ms / \uB808\uBCA8", en: "Combo window +300ms per level" },
      branch: "combo",
      prerequisites: ["combo_root"],
      baseCost: 100,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "combo_window_ms", magnitudePerLevel: 300 },
      position: { x: 0.48, y: 0.32 }
    },
    {
      id: "combo_focus",
      name: { ko: "\uC9D1\uC911", en: "Focus" },
      description: { ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +0.5% / \uB808\uBCA8", en: "Damage per combo stack +0.5% per level" },
      branch: "combo",
      prerequisites: ["combo_breath"],
      baseCost: 280,
      costMul: 1.85,
      maxLevel: 5,
      effect: { kind: "combo_max_bonus", magnitudePerLevel: 5e-3 },
      position: { x: 0.5, y: 0.45 }
    },
    {
      id: "combo_zen",
      name: { ko: "\uC120(\u79AA)", en: "Zen" },
      description: { ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +1% / \uB808\uBCA8", en: "Damage per combo stack +1% per level" },
      branch: "combo",
      prerequisites: ["combo_focus"],
      baseCost: 1200,
      costMul: 2,
      maxLevel: 3,
      effect: { kind: "combo_max_bonus", magnitudePerLevel: 0.01 },
      position: { x: 0.52, y: 0.6 }
    },
    {
      id: "drop_root",
      name: { ko: "\uB178\uD68D\uC790", en: "Scavenger" },
      description: { ko: "\uB4DC\uB78D\uB960 +5% / \uB808\uBCA8", en: "Drop rate +5% per level" },
      branch: "drop",
      prerequisites: [],
      baseCost: 30,
      costMul: 1.6,
      maxLevel: 5,
      effect: { kind: "drop_rate_mul", magnitudePerLevel: 0.05 },
      position: { x: 0.68, y: 0.2 }
    },
    {
      id: "drop_eye",
      name: { ko: "\uAD11\uB9E5\uC758 \uB208", en: "Vein Eye" },
      description: { ko: "\uB4DC\uB78D\uB960 +8% / \uB808\uBCA8", en: "Drop rate +8% per level" },
      branch: "drop",
      prerequisites: ["drop_root"],
      baseCost: 90,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "drop_rate_mul", magnitudePerLevel: 0.08 },
      position: { x: 0.68, y: 0.32 }
    },
    {
      id: "drop_magnet",
      name: { ko: "\uC790\uAE30 \uCF54\uC5B4", en: "Magnetic Core" },
      description: { ko: "\uB4DC\uB78D\uB960 +12% / \uB808\uBCA8", en: "Drop rate +12% per level" },
      branch: "drop",
      prerequisites: ["drop_eye"],
      baseCost: 280,
      costMul: 1.85,
      maxLevel: 5,
      effect: { kind: "drop_rate_mul", magnitudePerLevel: 0.12 },
      position: { x: 0.7, y: 0.45 }
    },
    {
      id: "drop_oracle",
      name: { ko: "\uAD11\uBB3C \uC624\uB77C\uD074", en: "Mineral Oracle" },
      description: { ko: "\uB4DC\uB78D\uB960 +20% / \uB808\uBCA8", en: "Drop rate +20% per level" },
      branch: "drop",
      prerequisites: ["drop_magnet"],
      baseCost: 1200,
      costMul: 2,
      maxLevel: 3,
      effect: { kind: "drop_rate_mul", magnitudePerLevel: 0.2 },
      position: { x: 0.72, y: 0.6 }
    },
    {
      id: "crystal_root",
      name: { ko: "\uD06C\uB9AC\uC2A4\uD0C8 \uBCF4\uB108\uC2A4", en: "Crystal Bonus" },
      description: { ko: "\uB7F0 \uC885\uB8CC \uC2DC \uD06C\uB9AC\uC2A4\uD0C8 +5 / \uB808\uBCA8", en: "Run-end crystals +5 per level" },
      branch: "crystal",
      prerequisites: [],
      baseCost: 60,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "crystal_run_bonus", magnitudePerLevel: 5 },
      position: { x: 0.85, y: 0.2 }
    },
    {
      id: "crystal_growth",
      name: { ko: "\uD06C\uB9AC\uC2A4\uD0C8 \uC131\uC7A5", en: "Crystal Growth" },
      description: { ko: "\uB7F0 \uC885\uB8CC \uC2DC \uD06C\uB9AC\uC2A4\uD0C8 +10 / \uB808\uBCA8", en: "Run-end crystals +10 per level" },
      branch: "crystal",
      prerequisites: ["crystal_root"],
      baseCost: 200,
      costMul: 1.85,
      maxLevel: 5,
      effect: { kind: "crystal_run_bonus", magnitudePerLevel: 10 },
      position: { x: 0.86, y: 0.34 }
    },
    {
      id: "crystal_avalanche",
      name: { ko: "\uD06C\uB9AC\uC2A4\uD0C8 \uC0AC\uD0DC", en: "Crystal Avalanche" },
      description: { ko: "\uB7F0 \uC885\uB8CC \uC2DC \uD06C\uB9AC\uC2A4\uD0C8 +25 / \uB808\uBCA8", en: "Run-end crystals +25 per level" },
      branch: "crystal",
      prerequisites: ["crystal_growth"],
      baseCost: 800,
      costMul: 2,
      maxLevel: 3,
      effect: { kind: "crystal_run_bonus", magnitudePerLevel: 25 },
      position: { x: 0.88, y: 0.5 }
    },
    {
      id: "meta_warmup",
      name: { ko: "\uCD9C\uBC1C \uC6CC\uBC0D\uC5C5", en: "Initial Warm-up" },
      description: { ko: "\uB7F0 \uC2DC\uC791 \uC2DC \uCF64\uBCF4 \uC720\uC9C0 +100ms / \uB808\uBCA8", en: "Start-of-run combo window +100ms per level" },
      branch: "meta",
      prerequisites: ["combo_root"],
      baseCost: 80,
      costMul: 1.7,
      maxLevel: 5,
      effect: { kind: "starting_combo_window_ms", magnitudePerLevel: 100 },
      position: { x: 0.4, y: 0.78 }
    },
    {
      id: "meta_pickaxe_call",
      name: { ko: "\uAD11\uBD80\uC758 \uBD80\uB984", en: "Miner's Call" },
      description: { ko: "\uACE1\uAD2D\uC774 +6% / \uAD11\uC11D \uAC00\uCE58 +6% / \uB808\uBCA8", en: "Damage +6% AND value +6% per level" },
      branch: "meta",
      prerequisites: ["pickaxe_master", "ore_value_grandmaster"],
      baseCost: 2500,
      costMul: 2.2,
      maxLevel: 3,
      effect: { kind: "damage_mul", magnitudePerLevel: 0.06 },
      position: { x: 0.2, y: 0.78 }
    },
    {
      id: "meta_combo_drop",
      name: { ko: "\uD0D0\uC695\uC758 \uBC15\uC790", en: "Greedy Tempo" },
      description: { ko: "\uCF64\uBCF4 1\uB2F9 \uB370\uBBF8\uC9C0 +0.4% / \uB4DC\uB78D\uB960 +4% / \uB808\uBCA8", en: "Combo bonus +0.4% AND drop +4% per level" },
      branch: "meta",
      prerequisites: ["combo_zen", "drop_oracle"],
      baseCost: 3e3,
      costMul: 2.2,
      maxLevel: 3,
      effect: { kind: "combo_max_bonus", magnitudePerLevel: 4e-3 },
      position: { x: 0.6, y: 0.78 }
    }
  ]
};

// src/core/rules/skillTree.ts
var RAW = skill_nodes_default;
var NODE_MAP = new Map(
  RAW.nodes.map((n) => [
    asSkillNodeId(n.id),
    {
      id: asSkillNodeId(n.id),
      name: n.name,
      description: n.description,
      branch: n.branch,
      prerequisites: n.prerequisites.map(asSkillNodeId),
      baseCost: n.baseCost,
      costMul: n.costMul,
      maxLevel: n.maxLevel,
      effect: n.effect,
      position: n.position
    }
  ])
);
function getNodeDef(id) {
  return NODE_MAP.get(id) ?? null;
}
function computeNodeCost(def, currentLevel) {
  return Math.round(def.baseCost * Math.pow(def.costMul, currentLevel));
}
function isUnlockable(state, nodeId) {
  const def = NODE_MAP.get(nodeId);
  if (!def) return false;
  if (state.meta.skillTree[nodeId]?.unlocked) return false;
  for (const pre of def.prerequisites) {
    const s = state.meta.skillTree[pre];
    if (!s?.unlocked || s.level < 1) return false;
  }
  return true;
}
function computeMetaModifiers(state) {
  let m = { ...DEFAULT_RUN_MODIFIERS };
  for (const [nodeId, nodeState] of Object.entries(state.meta.skillTree)) {
    if (!nodeState.unlocked) continue;
    const def = NODE_MAP.get(nodeId);
    if (!def) continue;
    const level = nodeState.level;
    if (level <= 0) continue;
    switch (def.effect.kind) {
      case "damage_mul":
        m = { ...m, damageMul: m.damageMul + def.effect.magnitudePerLevel * level };
        break;
      case "combo_window_ms":
        m = {
          ...m,
          comboWindowMs: m.comboWindowMs + def.effect.magnitudePerLevel * level
        };
        break;
      case "starting_combo_window_ms":
        m = {
          ...m,
          comboWindowMs: m.comboWindowMs + def.effect.magnitudePerLevel * level
        };
        break;
      case "ore_value_mul":
        m = { ...m, oreValueMul: m.oreValueMul + def.effect.magnitudePerLevel * level };
        break;
      case "drop_rate_mul":
        m = { ...m, dropRateMul: m.dropRateMul + def.effect.magnitudePerLevel * level };
        break;
      case "combo_max_bonus":
        m = {
          ...m,
          comboMaxBonus: m.comboMaxBonus + def.effect.magnitudePerLevel * level
        };
        break;
      case "crystal_run_bonus":
        break;
    }
  }
  return m;
}

// src/core/reducers/runReducer.ts
function defaultPickaxe() {
  const def = content.pickaxes.get(asPickaxeId("basic_pickaxe"));
  if (def) {
    return {
      pickaxeId: def.id,
      damage: def.damage,
      speed: def.speed,
      range: def.range,
      comboBonus: def.comboBonus
    };
  }
  return {
    pickaxeId: asPickaxeId("basic_pickaxe"),
    damage: 10,
    speed: 4,
    range: 50,
    comboBonus: 0.05
  };
}
function appendRunEvent(run, event) {
  const events = run.events.length >= MAX_REPLAY_EVENTS ? [...run.events.slice(1), event] : [...run.events, event];
  return { ...run, events };
}
function buildVein(stageId, depth, veinIndex, rngState) {
  const stage = content.stages.get(stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  const hp = computeVeinHp(stage, depth, veinIndex);
  const rng = new Mulberry32(rngState);
  const pool = buildMineralPool(content, depth);
  rng.next();
  return {
    vein: { veinIndex, hp, maxHp: hp, mineralPool: pool },
    rngState: rng.getState()
  };
}
function elapsed(run) {
  return run.duration - run.remaining;
}
function start(state, action) {
  const { runId, seed, stageId, depth, durationMs } = action.payload;
  const { vein, rngState } = buildVein(stageId, depth, 0, seed);
  const baselineModifiers = computeMetaModifiers(state);
  const run = {
    runId,
    seed,
    rngState,
    startedAt: action.payload.now,
    duration: durationMs,
    remaining: durationMs,
    depth,
    stageId,
    pickaxe: defaultPickaxe(),
    vein,
    veinsDestroyed: 0,
    cards: [],
    modifiers: baselineModifiers,
    cardOffer: null,
    combo: 0,
    comboExpiresAt: null,
    oresCollected: {},
    damageDealt: 0,
    events: [],
    finished: null
  };
  return {
    ...state,
    run,
    updatedAt: action.payload.now,
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        totalRuns: state.meta.stats.totalRuns + 1
      }
    }
  };
}
function tick(state, action) {
  if (!state.run) return state;
  const remaining = Math.max(0, state.run.remaining - action.payload.deltaMs);
  let run = { ...state.run, remaining };
  if (run.comboExpiresAt !== null) {
    const e = elapsed(run);
    if (e >= run.comboExpiresAt) {
      run = appendRunEvent({ ...run, combo: 0, comboExpiresAt: null }, {
        type: "combo_break",
        t: e
      });
    }
  }
  return { ...state, run };
}
function end(state, action) {
  if (!state.run) return state;
  const playTimeMs = state.run.duration - state.run.remaining;
  const rewardOres = {};
  for (const [id, count] of Object.entries(state.run.oresCollected)) {
    rewardOres[id] = Math.round(count * state.run.modifiers.oreValueMul);
  }
  const finished = {
    endedAt: action.payload.now,
    reason: action.payload.reason,
    oresCollected: { ...state.run.oresCollected },
    veinsDestroyed: state.run.veinsDestroyed,
    cardsPicked: state.run.cards.length,
    rewardOres
  };
  return {
    ...state,
    // run을 즉시 null로 만들지 않음 — 결과 화면 표시 후 dismiss 시 null로
    run: { ...state.run, finished },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        totalPlayTimeMs: state.meta.stats.totalPlayTimeMs + playTimeMs
      }
    }
  };
}
function mineHit(state, action) {
  if (!state.run || state.run.finished) return state;
  let run = state.run;
  const e = elapsed(run);
  const stillInCombo = run.comboExpiresAt !== null && e < run.comboExpiresAt;
  const newCombo = stillInCombo ? run.combo + 1 : 1;
  const comboExpiresAt = e + run.modifiers.comboWindowMs;
  const dmg = computeDamage({
    pickaxe: run.pickaxe,
    modifiers: run.modifiers,
    combo: newCombo
  });
  const newHp = Math.max(0, run.vein.hp - dmg.final);
  run = {
    ...run,
    combo: newCombo,
    comboExpiresAt,
    damageDealt: run.damageDealt + dmg.final,
    vein: { ...run.vein, hp: newHp }
  };
  run = appendRunEvent(run, {
    type: "mine_hit",
    t: action.payload.t,
    x: action.payload.x,
    y: action.payload.y,
    damage: dmg.final,
    combo: newCombo
  });
  const rng = new Mulberry32(run.rngState);
  const drop = tryDrop(
    run.vein.mineralPool,
    content,
    rng,
    BASE_DROP_CHANCE,
    run.modifiers.dropRateMul
  );
  run = { ...run, rngState: rng.getState() };
  if (drop) {
    const current = run.oresCollected[drop.mineralId] ?? 0;
    run = {
      ...run,
      oresCollected: { ...run.oresCollected, [drop.mineralId]: current + drop.amount }
    };
    run = appendRunEvent(run, {
      type: "ore_collected",
      t: action.payload.t,
      mineralId: drop.mineralId,
      amount: drop.amount
    });
  }
  if (newHp <= 0) {
    run = appendRunEvent(run, {
      type: "vein_destroyed",
      t: action.payload.t,
      veinIndex: run.vein.veinIndex
    });
    const next = buildVein(run.stageId, run.depth, run.vein.veinIndex + 1, run.rngState);
    const veinsDestroyed = run.veinsDestroyed + 1;
    run = {
      ...run,
      vein: next.vein,
      rngState: next.rngState,
      veinsDestroyed
    };
    if (run.cardOffer === null) {
      const rng2 = new Mulberry32(run.rngState);
      const offer = rollCardOffer(content, rng2, {
        pickedCardIds: run.cards.map((c) => c.cardId),
        progress: progressFromVeinsDestroyed(veinsDestroyed),
        count: 3,
        rerollCost: 50 + veinsDestroyed * 20
      });
      run = {
        ...run,
        rngState: rng2.getState(),
        cardOffer: {
          generatedAt: action.payload.t,
          cards: offer.cards.map((c) => ({ cardId: c.cardId, rarity: c.rarity })),
          rerollCost: offer.rerollCost
        }
      };
      run = appendRunEvent(run, {
        type: "card_offer_generated",
        t: action.payload.t,
        cardIds: offer.cards.map((c) => c.cardId)
      });
    }
  }
  return { ...state, run };
}
function oreCollected(state, action) {
  if (!state.run) return state;
  const { mineralId, amount, t } = action.payload;
  const current = state.run.oresCollected[mineralId] ?? 0;
  const run = appendRunEvent(state.run, { type: "ore_collected", t, mineralId, amount });
  return {
    ...state,
    run: {
      ...run,
      oresCollected: { ...run.oresCollected, [mineralId]: current + amount }
    }
  };
}
function comboBreak(state, action) {
  if (!state.run) return state;
  const run = appendRunEvent(
    { ...state.run, combo: 0, comboExpiresAt: null },
    { type: "combo_break", t: action.payload.t }
  );
  return { ...state, run };
}
function veinDestroyed(state, _action) {
  return state;
}
function depthAdvance(state, action) {
  if (!state.run) return state;
  const next = buildVein(
    state.run.stageId,
    action.payload.newDepth,
    0,
    state.run.rngState
  );
  const run = appendRunEvent(
    {
      ...state.run,
      depth: action.payload.newDepth,
      vein: next.vein,
      rngState: next.rngState
    },
    { type: "depth_advance", t: action.payload.t, newDepth: action.payload.newDepth }
  );
  return { ...state, run };
}
function cardOfferGenerated(state, action) {
  if (!state.run) return state;
  const cards = action.payload.cardIds.map((id) => {
    const def = content.cards.get(id);
    return def ? { cardId: id, rarity: def.rarity } : null;
  }).filter((x) => x !== null);
  return {
    ...state,
    run: {
      ...state.run,
      cardOffer: {
        generatedAt: action.payload.t,
        cards,
        rerollCost: action.payload.rerollCost
      }
    }
  };
}
function cardPicked(state, action) {
  if (!state.run || !state.run.cardOffer) return state;
  const def = content.cards.get(action.payload.cardId);
  if (!def) return state;
  const newModifiers = applyCardEffect(
    state.run.modifiers,
    def.effect,
    def.magnitude
  );
  let run = {
    ...state.run,
    modifiers: newModifiers,
    cards: [...state.run.cards, { cardId: def.id, pickedAt: action.payload.t }],
    cardOffer: null
  };
  run = appendRunEvent(run, { type: "card_picked", t: action.payload.t, cardId: def.id });
  return { ...state, run };
}
function cardReroll(state, action) {
  if (!state.run || !state.run.cardOffer) return state;
  const cost = action.payload.cost;
  if (state.economy.crystals < cost) return state;
  const economy = { ...state.economy, crystals: state.economy.crystals - cost };
  const rng = new Mulberry32(state.run.rngState);
  const offer = rollCardOffer(content, rng, {
    pickedCardIds: state.run.cards.map((c) => c.cardId),
    progress: progressFromVeinsDestroyed(state.run.veinsDestroyed),
    count: 3,
    rerollCost: Math.round(state.run.cardOffer.rerollCost * 1.5)
  });
  let run = {
    ...state.run,
    rngState: rng.getState(),
    cardOffer: {
      generatedAt: action.payload.t,
      cards: offer.cards.map((c) => ({ cardId: c.cardId, rarity: c.rarity })),
      rerollCost: offer.rerollCost
    }
  };
  run = appendRunEvent(run, { type: "card_rerolled", t: action.payload.t });
  return { ...state, run, economy };
}
var runReducer = {
  start,
  tick,
  end,
  mineHit,
  oreCollected,
  comboBreak,
  veinDestroyed,
  depthAdvance,
  cardOfferGenerated,
  cardPicked,
  cardReroll
};

// src/core/reducers/economyReducer.ts
function applyRunReward(state, action) {
  if (action.payload.crystals < 0) return state;
  for (const n of Object.values(action.payload.ores)) {
    if (n < 0) return state;
  }
  const newOres = { ...state.economy.ores };
  for (const [id, amount] of Object.entries(action.payload.ores)) {
    newOres[id] = (newOres[id] ?? 0) + amount;
  }
  const bestRunValueCrystals = Math.max(
    state.meta.stats.bestRunValueCrystals ?? 0,
    action.payload.crystals
  );
  return {
    ...state,
    economy: {
      ores: newOres,
      crystals: state.economy.crystals + action.payload.crystals
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        bestRunValueCrystals
      }
    }
  };
}
var economyReducer = { applyRunReward };

// src/core/reducers/metaReducer.ts
function unlockSkillNode(state, action) {
  const nodeId = action.payload.nodeId;
  const def = getNodeDef(nodeId);
  if (!def) return state;
  const existing = state.meta.skillTree[nodeId];
  if (existing?.unlocked) return state;
  if (!isUnlockable(state, nodeId)) return state;
  const cost = computeNodeCost(def, 0);
  if (state.economy.crystals < cost) return state;
  return {
    ...state,
    economy: { ...state.economy, crystals: state.economy.crystals - cost },
    meta: {
      ...state.meta,
      skillTree: {
        ...state.meta.skillTree,
        [nodeId]: { unlocked: true, level: 1 }
      }
    }
  };
}
function levelUpSkillNode(state, action) {
  const nodeId = action.payload.nodeId;
  const def = getNodeDef(nodeId);
  if (!def) return state;
  const existing = state.meta.skillTree[nodeId];
  if (!existing?.unlocked) return state;
  if (existing.level >= def.maxLevel) return state;
  const cost = computeNodeCost(def, existing.level);
  if (state.economy.crystals < cost) return state;
  return {
    ...state,
    economy: { ...state.economy, crystals: state.economy.crystals - cost },
    meta: {
      ...state.meta,
      skillTree: {
        ...state.meta.skillTree,
        [nodeId]: { unlocked: true, level: existing.level + 1 }
      }
    }
  };
}
var metaReducer = { unlockSkillNode, levelUpSkillNode };

// src/core/reducers/index.ts
function rootReducer(state, action) {
  switch (action.type) {
    // -- Run lifecycle --
    case "RUN_START":
      return runReducer.start(state, action);
    case "RUN_TICK":
      return runReducer.tick(state, action);
    case "RUN_END":
      return runReducer.end(state, action);
    // -- Mining --
    case "MINE_HIT":
      return runReducer.mineHit(state, action);
    case "ORE_COLLECTED":
      return runReducer.oreCollected(state, action);
    case "COMBO_BREAK":
      return runReducer.comboBreak(state, action);
    case "VEIN_DESTROYED":
      return runReducer.veinDestroyed(state, action);
    case "DEPTH_ADVANCE":
      return runReducer.depthAdvance(state, action);
    // -- Cards --
    case "CARD_OFFER_GENERATED":
      return runReducer.cardOfferGenerated(state, action);
    case "CARD_PICKED":
      return runReducer.cardPicked(state, action);
    case "CARD_REROLL":
      return runReducer.cardReroll(state, action);
    // -- Economy / Meta --
    case "META_RUN_REWARD":
      return economyReducer.applyRunReward(state, action);
    case "SKILL_NODE_UNLOCK":
      return metaReducer.unlockSkillNode(state, action);
    case "SKILL_NODE_LEVEL_UP":
      return metaReducer.levelUpSkillNode(state, action);
    // -- Persistence --
    case "STATE_HYDRATE":
      return action.payload.state;
    case "SCHEMA_MIGRATE":
      return { ...state, schemaVersion: action.payload.toVersion };
    default: {
      const _exhaustive = action;
      void _exhaustive;
      return state;
    }
  }
}
export {
  rootReducer
};
