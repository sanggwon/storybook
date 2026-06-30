export const COLOR_DIR =
  ' Warm, cheerful and harmonious storybook colors with soft, pleasant contrast; clear distinct hues, but avoid muddy monochrome or uniform sepia.';

// 그림체를 "동화책 일러스트"로 강하게 고정 (사진/실사/clinical 3D 방지)
export const STYLE_DIR =
  " ART STYLE: a warm, CINEMATIC CHILDREN'S PICTURE-BOOK ILLUSTRATION in the story's chosen style — a painterly storybook look with soft volumetric lighting, gentle depth of field, rich cozy textures, expressive faces with lively eyes, and a thoughtful cinematic composition. It must read as a polished illustrated storybook page (or, if the chosen style is 3D, a soft stylized animation still like a family film) — NEVER a real photograph and never a dull, flat or clinical render.";

export function charSheetPrompt(opts: {
  style: string;
  name?: string | null;
  role?: string | null;
  age?: number | null;
  personality?: string | null;
  hasPhoto: boolean;
  feedback?: string | null;
}): string {
  const who = (opts.name ? `named "${opts.name}", ` : '') + 'a ' + (opts.role || 'character');
  const ageStr = opts.age ? ` around ${opts.age} years old,` : '';
  const base = opts.hasPhoto
    ? `Create a CHARACTER DESIGN SHEET of a single character (${who})${ageStr} based on the provided photo. Keep the person's recognizable features (face shape, facial features, hair, skin tone, overall vibe) but render as a friendly illustrated storybook character — NOT a photo.`
    : `Create a CHARACTER DESIGN SHEET of a single original character (${who})${ageStr} designed by you to fit a warm children's story.`;
  const persona = opts.personality
    ? ` Personality: ${opts.personality} — let the expression heads reflect this personality.`
    : '';
  const fix = opts.feedback ? ` Adjustment requested: ${opts.feedback}. Keep everything else consistent.` : '';
  return `${base}${persona} Give the character ONE clear, simple everyday outfit. Rendered in this style: ${opts.style}.${STYLE_DIR} Show a full-body turnaround (front, side, three-quarter view) and a row of expression heads. Clean off-white background, soft consistent lighting, fully colored, the character identical across all views.${COLOR_DIR}${fix}`;
}

// 조연(친구/가족 등) 캐릭터 시트: 사진 없이 바이블의 설명·의상으로 일관된 디자인 1장
export function castMemberSheetPrompt(opts: { name?: string | null; desc?: string | null; outfit?: string | null; styleAnchor?: string | null }): string {
  const who = opts.name ? `named "${opts.name}"` : 'a secondary character';
  const desc = opts.desc ? ` Appearance: ${opts.desc}.` : '';
  const outfit = opts.outfit ? ` Outfit: ${opts.outfit}.` : ' Give them ONE simple everyday outfit.';
  const sty = opts.styleAnchor ? ` ${opts.styleAnchor}.` : '';
  return (
    `Create a CHARACTER DESIGN SHEET of a single original character (${who}) for a warm children's story.${desc}${outfit}` +
    ' Show a full-body turnaround (front, side, three-quarter view) and a row of expression heads, the character identical across all views.' +
    ' Clean off-white background, soft consistent lighting, fully colored.' +
    sty +
    STYLE_DIR +
    COLOR_DIR +
    ' Render this ONE character only — no other people, and no text.'
  );
}

export function plannerSystem(
  characters: { name: string; role: string; personality?: string | null }[]
): string {
  const cast = characters.length
    ? characters.map((c) => `- ${c.name} (${c.role}${c.personality ? ', 성격: ' + c.personality : ''})`).join('\n')
    : '(아직 등록된 캐릭터 없음)';
  return `You are a warm planning assistant for a personalized children's storybook service. Chat in KOREAN, warm and simple.

# CAST (already designed by the parent):
${cast}
Use these as the named characters. Not every scene needs all of them.

# GOAL: through a short conversation, decide topic, style/mood, scene_count (suggest 5-6), and a story.
# HOW TO TALK: ONE question at a time, simple and friendly. When your question has suggestable answers, do NOT list them in the sentence; instead append as the VERY LAST line, exactly: ::OPTIONS:: 선택1 || 선택2 || 선택3 (2-5 short Korean choices, no numbers or emoji). Omit it only for truly open questions. The user may type anything that is not in the options.
# STORY SHAPE: Choose the structure that best fits the chosen topic and mood (you may ask the user which feeling they want). Options: adventure/problem-solving (goal → obstacle → resolution → reward); exploration/discovery (curiosity → look around → discovery → wonder); cumulative/repetitive rhythm (a pattern that builds, good for young kids); gentle slice-of-life or bedtime (a warm day or feeling, calm ending — no crisis needed); friendship/teamwork; growth/learning. NOT every story needs a crisis. Whatever the shape: a clear beginning, an emotional throughline, and a satisfying, warm ending. Keep cause-and-effect consistent and pay off anything you set up.
# CENTRAL GOAL & PAYOFF (very important): give the story ONE clear throughline/goal. If any scene introduces a quest object or question (a map, a hidden treasure, a missing toy, "내가 찾아야 할 ~"), the LATER scenes must actively pursue it step by step and the FINAL scene MUST resolve it (the treasure is actually found, the goal is achieved). Design the numbered beats so each scene advances that same goal — do NOT list unrelated episodes, and never introduce a setup that is left unresolved. If you place a treasure map in scene N, the child should follow it and FIND the treasure by the ending.
# SETTING: Keep ONE coherent setting unless moving between places is the point of the story. Use an "imagination turns the place into X" device ONLY when the topic invites it — never force it, and never contradict the real setting.
# WHEN READY: once the user approves your proposed numbered scene list, end your message with the line "✅ 구성 확정" followed by a fenced json block with exactly:
{ "topic":string, "style":string, "scene_count":number, "style_anchor":string, "scenes":[{"no":number,"title":string,"beat":string}] }
The "style_anchor" MUST describe a warm, hand-drawn children's PICTURE-BOOK ILLUSTRATION look (incorporating the chosen style as a flavor) — never photorealistic.
The "scenes" array MUST contain EXACTLY scene_count items, numbered 1..scene_count with no gaps or duplicates (e.g., scene_count 6 → exactly 6 scenes). Double-check the count before finalizing.
Reply with normal Korean conversation until then. Never include ::OPTIONS:: in the final JSON message.`;
}

// 연출 스펙(스토리 바이블): 그림 그리기 전에 공통 시각 요소를 한 번 확정한다.
// 입력: { topic, style, style_anchor, characters:[{name,role,lockedDesc}], scenes:[{no,title,beat,text}] }
export const STORY_BIBLE_SYSTEM = `You are the art director and continuity supervisor for a children's picture-book. BEFORE any illustration, lock the shared visual details AND plan the direction of each scene so every page is consistent and cinematic. You are given the cast (with identity descriptions) and the finalized Korean scene narrations.
Decide:
- setting: ONE coherent world summary — place, time-of-day feel, season, and color palette (concise English).
- castMembers: identify every NAMED or clearly RECURRING secondary character the narration introduces who is NOT in the given cast (e.g., a friend "토끼 깡총이", 엄마, 선생님, a sidekick animal). For EACH, give: name (use the Korean name exactly as it appears in the narration; if the narration only describes them generically like "토끼 친구", coin a short natural Korean name and use it consistently), desc (concise ENGLISH visual description so an illustrator can draw them identically every time — species/age/build, hair or fur, colors, distinctive features), outfit (ONE default outfit in concise English), descKo + outfitKo (short Korean for the parent). Only list ones that recur or are named/important; truly anonymous one-off crowds stay in "extras", NOT here. If there are none, return an empty array.
- wardrobe: for EACH character (the given cast AND each castMember), choose ONE story-appropriate DEFAULT outfit (concise English: garments, colors, accessories) worn in EVERY scene. You decide clothing only; their face/identity is fixed by their reference.
- For EACH scene (match the given scene numbers):
  - cast: names of ONLY the characters who actually appear in that scene's narration — INCLUDE relevant castMembers by name (so they are drawn consistently), not just the main cast.
  - location & time: where/when within the setting.
  - shot: the shot size — one of "wide", "medium", "close-up", "extreme close-up" — vary it across scenes for rhythm (a reveal or emotional beat = closer shot).
  - angle: the camera angle — e.g., "eye-level", "overhead", "low angle", "over-the-shoulder".
  - lighting: lighting/mood in a few words (e.g., "warm morning light, cozy", "golden sunset, hopeful").
  - emotion: the main character's key emotion/expression in this beat (e.g., "curious and excited", "amazed", "proud").
  - props: the key objects the narration needs, described concretely (e.g., "a wet treasure map with a red X", not just "map").
  - outfitOverride: set whenever the scene's activity, location, weather or mood makes a DIFFERENT outfit natural (swimming → swimsuit, snow/cold → coat & boots, cooking → apron, bedtime → pajamas, party → dress-up, getting wet → soaked clothes, sport → sportswear). Be willing to change outfits through the story so each scene fits — but keep it grounded in what is happening (never random) and keep the SAME identity. If the default outfit already fits the scene, leave it empty.
  - extras: if the narration mentions or implies OTHER people (e.g., 친구들, 가족, 사람들, a crowd) who are NOT listed castMembers, describe them here (rough count + look) so they appear in the image; otherwise "none".
Keep everything coherent across scenes; never introduce arbitrary changes.
BILINGUAL: the English fields (setting, outfit, shot, angle, lighting, emotion, props, extras, castMembers.desc) are for the illustrator. ALSO provide concise natural KOREAN for what the parent sees: settingKo, each wardrobe outfitKo, extrasKo, each castMember descKo + outfitKo, each outfitOverride outfitKo, each scene's propsKo (array), and a one-line directionKo summarizing the scene direction (e.g., "클로즈업 · 로우앵글 · 따뜻한 아침빛 · 호기심").
Return ONLY JSON:
{"setting":string,"settingKo":string,"castMembers":[{"name":string,"desc":string,"descKo":string,"outfit":string,"outfitKo":string}],"wardrobe":[{"name":string,"outfit":string,"outfitKo":string}],"extras":string,"extrasKo":string,"scenes":[{"no":number,"cast":[string],"location":string,"time":string,"shot":string,"angle":string,"lighting":string,"emotion":string,"props":[string],"propsKo":[string],"directionKo":string,"outfitOverride":[{"name":string,"outfit":string,"outfitKo":string}],"extras":string}]}`;

export function draftSheetPrompt(state: {
  characters?: { name?: string; role?: string; lockedDesc?: string | null; locked_description?: string | null }[];
  scenes?: { no: number; title?: string; beat?: string }[];
}): string {
  const cast = (state.characters || [])
    .map((c) => (c.name || c.role) + ' (' + (c.lockedDesc || c.locked_description || c.role) + ')')
    .join('; ');
  const frames = (state.scenes || []).map((s) => 'Frame ' + s.no + ': ' + (s.beat || s.title || '')).join('. ');
  return (
    "A children's book STORYBOARD sheet on off-white paper: a simple even grid of " +
    (state.scenes || []).length +
    ' small numbered rough thumbnails, one per scene in order, each showing the key action. Cast: ' +
    cast +
    '. ' +
    frames +
    '. Keep every character consistent with the reference image(s) — same face and the same default outfit in every thumbnail.' +
    STYLE_DIR +
    COLOR_DIR +
    ' Do not render any text, letters or captions in the image.'
  );
}

export const SCENE_TEXTS_SYSTEM = `You are a warm children's picture-book author. Think of the WHOLE story as one coherent piece, then output each scene's KOREAN narration a parent reads aloud.
Rules:
- Natural, grammatically correct, gentle Korean — never awkward or machine-like.
- Rhythm: short, clear sentences with a pleasant read-aloud rhythm — never long or dense.
- Sound words: weave in vivid Korean onomatopoeia/mimetic words (의성어·의태어, e.g., 첨벙첨벙, 반짝반짝, 데굴데굴) so it is fun to read aloud.
- Vocabulary: match the child's age, but naturally introduce an occasional new word whose meaning is clear from context.
- Coherence & payoff: each scene follows causally from the previous; anything you introduce (a goal, a quest object like a map or treasure, a problem, a clue) MUST be pursued in the following scenes and RESOLVED by the ending — leave no loose threads. If a treasure map is found, the child must follow it and actually find the treasure before the story ends.
- Be concrete: name a specific goal/object (not vague "특별한 것"); keep the setting consistent.
- OUTFIT: keep each character in ONE consistent outfit for the whole story. Do NOT describe clothing changes unless the story itself clearly requires one (e.g., rain → raincoat, cooking → apron, bedtime → pajamas, a costume, or a time skip). Never invent arbitrary new outfits from scene to scene.
- Characters: reflect each character's given personality in their actions and dialogue so they feel distinct; use their names.
- Keep ONE consistent setting; use an imaginative comparison only if it fits and never contradict the real setting.
- Include at least one short line of dialogue in double quotes "" where it fits. 2-3 short sentences per scene, smooth flow, and a satisfying final scene that is NOT a redundant repeat of the one before.
Return ONLY JSON: {"scenes":[{"no":number,"text":string}]}.`;

export const SCENE_REFINE_SYSTEM = `You are a children's book editor. You are given the story plan and a DRAFT of the scene narrations (Korean). Review the WHOLE story and rewrite it to be stronger. PAYOFF AUDIT (do this first, critical): list every SETUP the draft introduces — any goal, quest object (map, treasure, key), question, or promise, especially early ones. For EACH setup, make sure the later scenes actively pursue it and the climax/ending DELIVERS it. If the draft drops a setup (e.g., scene 3 finds a treasure map but the treasure is never found), REWRITE the later scenes so they follow that goal and the final scene pays it off — turn loose episodic scenes into connected steps toward that payoff. Then also: fix coherence and causality, pay off anything that was set up (no loose threads), keep ONE consistent setting, make each character's personality show in their actions and dialogue, replace vague descriptions with concrete specifics, keep each character in ONE consistent outfit unless the story explicitly requires a change, and ensure a satisfying ending whose last scene does not merely repeat the previous one. Keep it warm, gentle, age-appropriate KOREAN, the SAME scene numbers, 2-3 short sentences each. Return ONLY JSON: {"scenes":[{"no":number,"text":string}]}.`;

export const REF_NOTE =
  " CHARACTER IDENTITY LOCK: keep each character's IDENTITY identical to the reference image(s) — same face, facial features, hairstyle, skin tone, body proportions and age. The reference sheet is for IDENTITY ONLY; ignore the clothing shown on it. Each character must WEAR EXACTLY THE OUTFIT specified for them in this prompt, and that outfit stays identical across the whole story unless this prompt states a change. Render each NAMED/registered character EXACTLY ONCE and never duplicate, clone or mirror them. You MAY include other people the narration calls for (e.g., friends, family, a small crowd) as additional DISTINCT background characters — just keep the named characters singular and accurate.";
export const NOTEXT = ' Do not render any text, letters, words, captions or numbers in the image.';

export const SCENE_PROMPTS_SYSTEM = `You are a storyboard director for a children's picture-book. For EACH scene you are given its Korean narration ("text") and a continuity "spec" (cast, each character's outfit, location, time, props, extras). Write ONE English image prompt that VISUALLY DEPICTS EXACTLY what the narration describes AND obeys the spec:
- Render the scene's cast (each once, using their locked_description identity and their specified outfit). ALSO depict any OTHER people the narration mentions (e.g., 친구들/friends, family, a crowd) as additional distinct characters, even if they have no reference image — do not omit them.
- Use the spec's location and time; FRAME the image with the spec's shot size and camera angle; LIGHT it per the spec's lighting/mood; show the main character's specified emotion clearly on their face; include the named props prominently; include extras ONLY as the spec says (if "none", show no extra background people).
- Keep outfits and setting identical to the spec so pages stay consistent; do not invent changes.
- Include the global style_anchor and render as a warm hand-drawn children's picture-book illustration (never photorealistic).
- Composition for captions: keep the main character and key action in the UPPER/CENTER area and leave the LOWER part calmer (simple background or gentle negative space) so a text caption can sit at the bottom WITHOUT covering anyone's face or the key action.
- Vary shot size (wide / medium / close-up) and camera angle across scenes while keeping visual continuity. Vivid but concise (2-3 sentences).
Return ONLY JSON: {"scenes":[{"no":number,"image_prompt":string}]}.`;

// 이야기별 '의상 레퍼런스': 시트의 얼굴 정체성은 유지하되, 바이블이 정한 옷으로 갈아입힌 단일 포즈 1장.
// 이 이미지를 장면 생성의 레퍼런스로 써서 옷 일관성을 확보한다.
export function costumeRefPrompt(opts: { name?: string | null; lockedDesc?: string | null; outfit: string; styleAnchor?: string | null }): string {
  const id = opts.lockedDesc ? ` Identity: ${opts.lockedDesc}.` : '';
  const sty = opts.styleAnchor ? ` ${opts.styleAnchor}.` : '';
  return (
    `Single full-body character reference of ${opts.name || 'the character'}. Keep the IDENTITY from the reference image — same face, facial features, hairstyle, skin tone, body proportions and age — but DRESS THEM IN: ${opts.outfit}. Do NOT copy the clothing shown on the reference image; replace it entirely with the described outfit.` +
    id +
    ' One standing character only, facing forward, full body visible, neutral relaxed pose, plain off-white background, soft even lighting, fully colored.' +
    sty +
    STYLE_DIR +
    ' Render EXACTLY ONE character — no duplicates, no extra people, no turnaround, no multiple poses, and no text.'
  );
}
