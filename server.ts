import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import conversationalSearch from './api/ai/conversational-search';
import {
  buildFlexibleSmartSearch,
  SmartSearchPropertyInput,
} from './src/utils/smartSearchEngine';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  /**
   * ENDPOINT: Asistente Inmobiliario Conversacional con IA (Clara - ClaveHogar)
   * Memoria conversacional acumulativa, reglas estrictas de ubicación (CABA vs Quilmes),
   * detección de direcciones reales sin repreguntas de zona, redirección off-topic a inmuebles,
   * aviso de zonas sin publicaciones con recomendación de alternativas que cumplen el resto de necesidades,
   * y envío ÚNICAMENTE de coincidencias exactas cuando existan.
   */
  app.post('/api/ai/conversational-search', conversationalSearch);

  /**
   * ENDPOINT ANTERIOR (Mantenido para compatibilidad directa)
   */
  app.post('/api/ai/smart-search', async (req, res) => {
    const { query, properties } = req.body as {
      query?: string;
      properties?: SmartSearchPropertyInput[];
    };

    if (!query || typeof query !== 'string' || !Array.isArray(properties)) {
      res.status(400).json({
        error: 'Se requiere una consulta en lenguaje natural y el listado de propiedades.',
      });
      return;
    }

    const heuristicResult = buildFlexibleSmartSearch(query, properties);
    res.json(heuristicResult);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClaveHogar server listening on http://localhost:${PORT}`);
  });
}

startServer();
