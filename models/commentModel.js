const pool = require('../config/database');

class Comment {
  // Obtener todos los comentarios con paginación
  static async getAll(page = 1, limit = 6) {
    try {
      const offset = (page - 1) * limit;

      // Consulta para obtener los comentarios de la página actual
      const query = `
        SELECT id, nombre, comentario, 
               TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada,
               fecha as fecha_original
        FROM comentarios 
        ORDER BY fecha DESC
        LIMIT $1 OFFSET $2
      `;
      const result = await pool.query(query, [limit, offset]);

      // Consulta para contar el total de comentarios
      const countQuery = `SELECT COUNT(*) FROM comentarios`;
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        comments: result.rows,
        totalPages,
        currentPage: page,
        totalComments: total
      };
    } catch (error) {
      console.error('Error en Comment.getAll:', error.message);
      throw error;
    }
  }

  // Obtener un comentario por ID
  static async getById(id) {
    try {
      const query = `
        SELECT id, nombre, comentario, 
               TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada
        FROM comentarios 
        WHERE id = $1
      `;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Comment.getById:', error.message);
      throw error;
    }
  }

  // Crear un nuevo comentario
  static async create(commentData) {
    try {
      const { nombre, comentario } = commentData;
      const query = `
        INSERT INTO comentarios (nombre, comentario) 
        VALUES ($1, $2) 
        RETURNING id, nombre, comentario,
                  TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada
      `;
      const values = [nombre, comentario];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Comment.create:', error.message);
      throw error;
    }
  }

  // Eliminar un comentario (opcional, para administración)
  static async delete(id) {
    try {
      const query = `DELETE FROM comentarios WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Comment.delete:', error.message);
      throw error;
    }
  }

  // Obtener estadísticas (opcional, para dashboard)
  static async getStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          TO_CHAR(MAX(fecha), 'DD/MM/YYYY') as ultimo_comentario,
          TO_CHAR(MIN(fecha), 'DD/MM/YYYY') as primer_comentario
        FROM comentarios
      `;
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Comment.getStats:', error.message);
      throw error;
    }
  }
}

module.exports = Comment;