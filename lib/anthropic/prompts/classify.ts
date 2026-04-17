export const CLASSIFY_SYSTEM_PROMPT = `You are a content classifier. You identify the type of business content provided.`;

export const CLASSIFY_USER_PROMPT = (text: string) => `Identify the most likely content type for the text below from this list: blog_post, email, report, proposal, press_release, social_post, memo.

Respond with ONLY the content type identifier, nothing else.

Text:
${text}`;
