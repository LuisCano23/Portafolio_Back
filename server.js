const express = require('express');
const cors = require('cors');
require('dotenv').config();
const https = require('https');

// Importar modelos
const Referencia = require('./models/referenciaModel');
const Comment = require('./models/commentModel');

const app = express();
const PORT = process.env.PORT || 5000;

// ========== MIDDLEWARE GLOBAL ==========

// Configurar CORS para producción/desarrollo
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || '*'
    : 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

// Configurar headers de seguridad (soluciona error CSP)
app.use((req, res, next) => {
  // Content Security Policy más flexible para API
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://hcaptcha.com;"
  );
  
  // Otros headers de seguridad recomendados
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
});

app.use(express.json());

// ========== RUTA RAIZ (HOME) - NUEVA ==========
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: '🚀 API del Portafolio funcionando correctamente',
    version: '1.0.0',
    documentation: 'Consulta los endpoints disponibles',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      referencias: {
        getAll: 'GET /api/referencias',
        getById: 'GET /api/referencias/:id',
        create: 'POST /api/referencias'
      },
      comments: {
        getAll: 'GET /api/comments?page=1&limit=6',
        getById: 'GET /api/comments/:id',
        create: 'POST /api/comments',
        delete: 'DELETE /api/comments/:id (admin)',
        stats: 'GET /api/comments/stats'
      },
      health: 'GET /api/health'
    }
  });
});

// ========== FUNCIÓN PARA VERIFICAR hCAPTCHA (REUTILIZABLE) ==========
const verifyCaptcha = (captchaToken) => {
  return new Promise((resolve, reject) => {
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
    
    // En desarrollo, simular éxito si no hay clave secreta
    if (process.env.NODE_ENV !== 'production' && (!hcaptchaSecret || hcaptchaSecret.includes('ES_'))) {
      return resolve({ success: true, challenge_ts: new Date().toISOString(), hostname: 'localhost' });
    }

    const postData = `secret=${hcaptchaSecret}&response=${captchaToken}`;

    const options = {
      hostname: 'hcaptcha.com',
      port: 443,
      path: '/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// ========== RUTAS DE REFERENCIAS ==========

// Obtener todas las referencias
app.get('/api/referencias', async (req, res) => {
  try {
    const referencias = await Referencia.getAll();
    
    res.json({
      success: true,
      message: 'Referencias obtenidas correctamente',
      count: referencias.length,
      data: referencias
    });
    
  } catch (error) {
    console.error('Error al obtener referencias:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las referencias de la base de datos'
    });
  }
});

// Obtener una referencia por ID
app.get('/api/referencias/:id', async (req, res) => {
  try {
    const referencia = await Referencia.getById(req.params.id);
    
    if (!referencia) {
      return res.status(404).json({
        success: false,
        error: 'Referencia no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: referencia
    });
    
  } catch (error) {
    console.error('Error al obtener referencia:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener la referencia'
    });
  }
});

// Crear una nueva referencia CON CAPTCHA
app.post('/api/referencias', async (req, res) => {
  try {
    const { nombre, titulo, correo, carta, captchaToken } = req.body;
    
    // Validación básica
    if (!nombre || !titulo || !correo || !carta) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos: nombre, titulo, correo, carta'
      });
    }

    // Validar longitud
    if (nombre.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'El nombre no puede exceder los 100 caracteres'
      });
    }

    if (carta.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'La carta no puede exceder los 1000 caracteres'
      });
    }

    // Verificar hCaptcha (solo en producción)
    if (process.env.NODE_ENV === 'production') {
      if (!captchaToken) {
        return res.status(400).json({
          success: false,
          error: 'Captcha requerido'
        });
      }

      try {
        const captchaResult = await verifyCaptcha(captchaToken);
        
        if (!captchaResult.success) {
          console.log('Captcha fallido en referencia:', captchaResult);
          return res.status(400).json({
            success: false,
            error: 'Captcha no válido. Por favor, inténtalo de nuevo.'
          });
        }
      } catch (captchaError) {
        console.error('Error al verificar hCaptcha (referencia):', captchaError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar el captcha'
        });
      }
    }
    
    // Crear la referencia
    const nuevaReferencia = await Referencia.create({ nombre, titulo, correo, carta });
    
    res.status(201).json({
      success: true,
      message: 'Referencia creada exitosamente',
      data: nuevaReferencia
    });
    
  } catch (error) {
    console.error('Error al crear referencia:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al crear la referencia'
    });
  }
});

// ========== RUTAS DE COMENTARIOS ==========

// Obtener comentarios con paginación
app.get('/api/comments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    const { comments, totalPages, currentPage, totalComments } = await Comment.getAll(page, limit);

    res.json({
      success: true,
      message: 'Comentarios obtenidos correctamente',
      comments,
      totalPages,
      currentPage,
      totalComments,
      commentsPerPage: limit
    });

  } catch (error) {
    console.error('Error al obtener comentarios:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los comentarios de la base de datos'
    });
  }
});

// Crear un nuevo comentario con verificación de hCaptcha
app.post('/api/comments', async (req, res) => {
  try {
    const { nombre, comentario, captchaToken } = req.body;

    // Validación básica
    if (!nombre || !comentario) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos: nombre, comentario'
      });
    }

    // Validar longitud
    if (nombre.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'El nombre no puede exceder los 100 caracteres'
      });
    }

    if (comentario.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'El comentario no puede exceder los 1000 caracteres'
      });
    }

    // Verificar hCaptcha (solo en producción)
    if (process.env.NODE_ENV === 'production') {
      if (!captchaToken) {
        return res.status(400).json({
          success: false,
          error: 'Captcha requerido'
        });
      }

      try {
        const captchaResult = await verifyCaptcha(captchaToken);
        
        if (!captchaResult.success) {
          console.log('Captcha fallido en comentario:', captchaResult);
          return res.status(400).json({
            success: false,
            error: 'Captcha no válido. Por favor, inténtalo de nuevo.'
          });
        }
      } catch (captchaError) {
        console.error('Error al verificar hCaptcha (comentario):', captchaError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar el captcha'
        });
      }
    }

    // Crear el comentario en la base de datos
    const nuevoComentario = await Comment.create({ nombre, comentario });

    res.status(201).json({
      success: true,
      message: 'Comentario creado exitosamente',
      data: nuevoComentario
    });

  } catch (error) {
    console.error('Error al crear comentario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al crear el comentario en la base de datos'
    });
  }
});

// Obtener un comentario por ID
app.get('/api/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.getById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comentario no encontrado'
      });
    }

    res.json({
      success: true,
      data: comment
    });

  } catch (error) {
    console.error('Error al obtener comentario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el comentario'
    });
  }
});

// Eliminar un comentario
app.delete('/api/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.delete(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comentario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Comentario eliminado exitosamente',
      data: comment
    });

  } catch (error) {
    console.error('Error al eliminar comentario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el comentario'
    });
  }
});

// Obtener estadísticas de comentarios
app.get('/api/comments/stats', async (req, res) => {
  try {
    const stats = await Comment.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las estadísticas'
    });
  }
});

// ========== RUTA DE SALUD MEJORADA ==========
app.get('/api/health', async (req, res) => {
  try {
    // Intenta conectar a la base de datos para verificar salud completa
    const dbHealth = await Comment.getStats(); // Usamos stats como prueba de conexión DB
    
    res.json({
      status: 'healthy',
      message: '✅ Servidor y base de datos funcionando correctamente',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        type: 'PostgreSQL',
        environment: process.env.NODE_ENV || 'development'
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// ========== MANEJO DE ERRORES 404 ==========
// Esto DEBE IR AL FINAL, después de TODAS las rutas API
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.originalUrl}`,
    suggestion: 'Visita la ruta raíz (/) para ver los endpoints disponibles',
    available_endpoints: {
      home: 'GET /',
      health: 'GET /api/health',
      references: ['GET /api/referencias', 'POST /api/referencias'],
      comments: ['GET /api/comments', 'POST /api/comments']
    }
  });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log(`
  🚀  Servidor backend iniciado
  🔗  Local: http://localhost:${PORT}
  🌐  Entorno: ${process.env.NODE_ENV || 'development'}
  📊  Base de datos: PostgreSQL ${process.env.DB_NAME || 'portfolio_db'}
  🔐  hCaptcha: ${process.env.NODE_ENV === 'production' ? 'Activado' : 'Modo desarrollo'}
  
  📍  Endpoints principales:
      GET  /                 → API Home
      GET  /api/health       → Health Check
      GET  /api/referencias  → Listar referencias
      POST /api/referencias  → Crear referencia
      GET  /api/comments     → Listar comentarios
      POST /api/comments     → Crear comentario
  
  ⚠️   En producción, asegúrate de configurar:
      - CORS_ORIGIN con la URL de tu frontend
      - Variables de entorno de Neon PostgreSQL
      - Claves reales de hCaptcha
  `);
});