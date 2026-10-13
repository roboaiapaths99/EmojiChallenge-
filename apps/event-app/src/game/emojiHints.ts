// Short, player-friendly coaching tips shown next to each target emoji.
// Keyed by EmojiProfile.id (see packages/expression-engine/src/profiles.ts).
const EMOJI_HINTS: Record<string, string> = {
  smile: "Smile wide — show your teeth!",
  surprised: "Drop your jaw open and raise your eyebrows.",
  wink: "Close just ONE eye and smile a little.",
  angry: "Pull your eyebrows down hard and frown.",
  laugh: "Big open-mouth smile, squeeze your eyes!",
  shocked: "Open your mouth wide and lift your brows high.",
  tongue: "Stick your tongue out and open your mouth.",
  wink_tongue: "Wink one eye and stick your tongue out.",
  raised_eyebrow: "Lift ONE eyebrow up, keep the other down.",
  heart_eyes: "Soft, happy smile with relaxed eyes.",
  pleading: "Raise your inner eyebrows and pout a little.",
  thinking: "Purse your lips and squint like you're thinking.",
  scream: "Mouth wide open, eyebrows way up!",
  neutral: "Relax your face completely — no expression.",
  grimace: "Stretch your lips wide and clench your teeth.",
  party: "Big smile with puffed cheeks!",
  kiss: "Pucker your lips like blowing a kiss.",
  smirk: "Smile on just ONE side of your mouth.",
  sleepy: "Let your eyes droop almost closed.",
  crazy: "Go wild — wide eyes, tongue out, be silly!",
};

export function getEmojiHint(profileId: string): string {
  return EMOJI_HINTS[profileId] ?? "Copy the emoji with your face!";
}
