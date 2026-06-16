import { executeTool } from './tools.js';

const MAX_TOOL_ROUNDS = 10;

/**
 * Runs the ReAct agentic loop:
 * Send message → if model calls tools → execute → send results → repeat → return final text.
 *
 * Stops when:
 *   a) Model returns a text response (no pending tool calls)
 *   b) MAX_TOOL_ROUNDS reached (safety cap)
 */
export const runLoop = async (chat, userTurn) => {
    let response = await chat.sendMessage(userTurn);
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
        const functionCalls = response.response.functionCalls?.() ?? [];

        if (functionCalls.length === 0) break;

        rounds++;

        const toolParts = await Promise.all(
            functionCalls.map(async (fc) => {
                const result = await executeTool(fc.name, fc.args);
                return {
                    functionResponse: {
                        name: fc.name,
                        response: {
                            content: typeof result === 'string' ? result : JSON.stringify(result)
                        }
                    }
                };
            })
        );

        response = await chat.sendMessage(toolParts);
    }

    const text = response.response.text();
    if (!text?.trim()) {
        throw new Error('El agente no generó respuesta de texto.');
    }

    return text.trim();
};
