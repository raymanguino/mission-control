/** Preset block-style avatars (filenames under `/avatars/{id}.svg`). */
export const AGENT_AVATAR_IDS = [
    'grass_block',
    'stone_block',
    'cobblestone',
    'oak_planks',
    'iron_ore',
    'gold_block',
    'diamond_block',
    'redstone_block',
    'creeper_face',
    'steve_face',
    'alex_face',
    'bee_face',
    'blaze_face',
    'drowned_face',
    'enderman_face',
    'herobrine_face',
    'pig_face',
    'skeleton_face',
    'spider_face',
    'villager_face',
    'zombie_face',
];
export const DEFAULT_AGENT_AVATAR_ID = 'grass_block';
export function agentAvatarSrc(avatarId) {
    const id = avatarId && AGENT_AVATAR_IDS.includes(avatarId)
        ? avatarId
        : DEFAULT_AGENT_AVATAR_ID;
    return `/avatars/${id}.svg`;
}
