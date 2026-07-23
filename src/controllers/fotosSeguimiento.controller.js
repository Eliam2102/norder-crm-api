import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import { FOLLOWUP_PHOTO_MIME_TYPES, hasValidImageSignature, parseFollowupPhotoDataUrl } from '../lib/followupPhoto.js';

const MAX_FOTOS_POR_CONSULTA = 4;
const MAX_BYTES_OPTIMIZADOS = 2_500_000;

const metadataSelect = {
    id: true,
    pacienteId: true,
    valoracionId: true,
    mimeType: true,
    nombreOriginal: true,
    tamanoBytes: true,
    ancho: true,
    alto: true,
    esPrincipal: true,
    createdAt: true,
};

const actor = (req) => ({
    actorId: req.user?.sub || req.user?.id || req.user?.email || null,
    actorTipo: 'nutriologo',
});

const ensureValoracion = async (pacienteId, valoracionId) => prisma.valoracion.findFirst({
    where: { id: valoracionId, pacienteId, deletedAt: null },
    select: { id: true },
});

export const list = async (req, res, next) => {
    try {
        const { pacienteId, id: valoracionId } = req.params;
        if (!await ensureValoracion(pacienteId, valoracionId)) return error(res, 'Consulta no encontrada', 404);
        const fotos = await prisma.fotoSeguimiento.findMany({
            where: { pacienteId, valoracionId },
            select: metadataSelect,
            orderBy: { createdAt: 'asc' },
        });
        return ok(res, fotos);
    } catch (err) { next(err); }
};

export const listPatient = async (req, res, next) => {
    try {
        const pacienteId = req.params.id;
        const fotos = await prisma.fotoSeguimiento.findMany({
            where: { pacienteId, valoracion: { deletedAt: null } },
            select: { ...metadataSelect, valoracion: { select: { fecha: true, numeroValoracion: true } } },
            orderBy: [{ valoracion: { fecha: 'desc' } }, { createdAt: 'asc' }],
        });
        return ok(res, fotos);
    } catch (err) { next(err); }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId, id: valoracionId } = req.params;
        if (!await ensureValoracion(pacienteId, valoracionId)) return error(res, 'Consulta no encontrada', 404);

        const parsed = parseFollowupPhotoDataUrl(req.body.dataUrl);
        if (!parsed || !FOLLOWUP_PHOTO_MIME_TYPES.has(parsed.mimeType) || !hasValidImageSignature(parsed.buffer, parsed.mimeType)) {
            return error(res, 'Formato inválido. Usa JPEG, PNG o WebP.', 415);
        }
        if (!parsed.buffer.length || parsed.buffer.length > MAX_BYTES_OPTIMIZADOS) {
            return error(res, 'La imagen optimizada supera 2.5 MB.', 413);
        }

        const count = await prisma.fotoSeguimiento.count({ where: { pacienteId, valoracionId } });
        if (count >= MAX_FOTOS_POR_CONSULTA) return error(res, 'Máximo 4 fotografías por consulta.', 409);

        const esPrincipal = req.body.esPrincipal === true || count === 0;
        const result = await prisma.$transaction(async (tx) => {
            if (esPrincipal) {
                await tx.fotoSeguimiento.updateMany({ where: { pacienteId, valoracionId }, data: { esPrincipal: false } });
            }
            const foto = await tx.fotoSeguimiento.create({
                data: {
                    pacienteId,
                    valoracionId,
                    datos: parsed.buffer,
                    mimeType: parsed.mimeType,
                    nombreOriginal: String(req.body.nombreOriginal || 'seguimiento').slice(0, 180),
                    tamanoBytes: parsed.buffer.length,
                    ancho: Number.isFinite(Number(req.body.ancho)) ? Number(req.body.ancho) : null,
                    alto: Number.isFinite(Number(req.body.alto)) ? Number(req.body.alto) : null,
                    esPrincipal,
                    cargadaPorId: actor(req).actorId,
                },
                select: metadataSelect,
            });
            await tx.fotoSeguimientoLog.create({
                data: { pacienteId, valoracionId, fotoId: foto.id, ...actor(req), accion: 'CARGADA', detalle: { nombre: foto.nombreOriginal, bytes: foto.tamanoBytes } },
            });
            return foto;
        });
        return ok(res, result, 201);
    } catch (err) { next(err); }
};

export const file = async (req, res, next) => {
    try {
        const { pacienteId, id: valoracionId, fotoId } = req.params;
        const foto = await prisma.fotoSeguimiento.findFirst({ where: { id: fotoId, pacienteId, valoracionId } });
        if (!foto) return error(res, 'Fotografía no encontrada', 404);
        res.setHeader('Content-Type', foto.mimeType);
        res.setHeader('Content-Length', String(foto.tamanoBytes));
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(Buffer.from(foto.datos));
    } catch (err) { next(err); }
};

export const setPrincipal = async (req, res, next) => {
    try {
        const { pacienteId, id: valoracionId, fotoId } = req.params;
        const exists = await prisma.fotoSeguimiento.findFirst({ where: { id: fotoId, pacienteId, valoracionId }, select: { id: true } });
        if (!exists) return error(res, 'Fotografía no encontrada', 404);
        await prisma.$transaction([
            prisma.fotoSeguimiento.updateMany({ where: { pacienteId, valoracionId }, data: { esPrincipal: false } }),
            prisma.fotoSeguimiento.update({ where: { id: fotoId }, data: { esPrincipal: true } }),
            prisma.fotoSeguimientoLog.create({ data: { pacienteId, valoracionId, fotoId, ...actor(req), accion: 'MARCAR_PRINCIPAL' } }),
        ]);
        return ok(res, { id: fotoId, esPrincipal: true });
    } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
    try {
        const { pacienteId, id: valoracionId, fotoId } = req.params;
        const foto = await prisma.fotoSeguimiento.findFirst({ where: { id: fotoId, pacienteId, valoracionId }, select: metadataSelect });
        if (!foto) return error(res, 'Fotografía no encontrada', 404);
        const reemplazoId = await prisma.$transaction(async (tx) => {
            await tx.fotoSeguimientoLog.create({
                data: { pacienteId, valoracionId, fotoId, ...actor(req), accion: 'ELIMINADA', detalle: { fotoId, nombre: foto.nombreOriginal, eraPrincipal: foto.esPrincipal } },
            });
            await tx.fotoSeguimiento.delete({ where: { id: fotoId } });
            if (foto.esPrincipal) {
                const reemplazo = await tx.fotoSeguimiento.findFirst({
                    where: { pacienteId, valoracionId },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true },
                });
                if (reemplazo) {
                    await tx.fotoSeguimiento.update({ where: { id: reemplazo.id }, data: { esPrincipal: true } });
                    await tx.fotoSeguimientoLog.create({
                        data: { pacienteId, valoracionId, fotoId: reemplazo.id, ...actor(req), accion: 'MARCAR_PRINCIPAL_AUTOMATICA' },
                    });
                    return reemplazo.id;
                }
            }
            return null;
        });
        return ok(res, { id: fotoId, deleted: true, eraPrincipal: foto.esPrincipal, reemplazoId });
    } catch (err) { next(err); }
};

export const listPortal = async (req, res, next) => {
    try {
        const fotos = await prisma.fotoSeguimiento.findMany({
            where: { pacienteId: req.paciente.id, valoracion: { deletedAt: null } },
            select: { ...metadataSelect, valoracion: { select: { fecha: true, numeroValoracion: true } } },
            orderBy: [{ valoracion: { fecha: 'desc' } }, { createdAt: 'asc' }],
        });
        return ok(res, fotos);
    } catch (err) { next(err); }
};

export const filePortal = async (req, res, next) => {
    try {
        const foto = await prisma.fotoSeguimiento.findFirst({ where: { id: req.params.fotoId, pacienteId: req.paciente.id } });
        if (!foto) return error(res, 'Fotografía no encontrada', 404);
        res.setHeader('Content-Type', foto.mimeType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(Buffer.from(foto.datos));
    } catch (err) { next(err); }
};
