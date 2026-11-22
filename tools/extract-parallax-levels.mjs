// Reads the supplied design pack's 100 level JSON briefs and writes a compact data module for the game.
import fs from 'node:fs';
const src = process.argv[2], out = process.argv[3];
const levels = [];
for (let i = 1; i <= 100; i++) {
  const j = JSON.parse(fs.readFileSync(`${src}/03_LEVELS_JSON/level_${String(i).padStart(3, '0')}.json`, 'utf8'));
  levels.push({ n: i, id: j.level_id, title: j.title, world: +j.world_id.slice(1), worldName: j.world_name, tier: j.difficulty_tier,
    minutes: [j.target_solve_time_minutes.min, j.target_solve_time_minutes.max], setting: j.setting, brief: j.puzzle_brief.split('. ')[0],
    mechanics: j.primary_mechanics, rewards: { coins: j.rewards.completion_coins, tier: j.rewards.difficulty_bonus, mastery: j.rewards.mastery_bonus, discovery: j.rewards.discovery_bonus }, hints: j.hint_ladder });
}
fs.writeFileSync(out, '/* Generated from the Parallax design pack (100 level briefs). */\nexport const LEVEL_BRIEFS = ' + JSON.stringify(levels) + ';\n');
console.log('wrote', levels.length);
