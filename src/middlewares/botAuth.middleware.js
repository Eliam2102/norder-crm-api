import { error } from '../utils/response.js';

const botAuthMiddleware = (req, res, next) => {
    const botToken = req.headers['x-bot-token'];

    if (!botToken || botToken !== process.env.BOT_API_TOKEN) {
        return error(res, 'No autorizado: Token de bot inválido', 401);
    }

    next();
};

export default botAuthMiddleware;
