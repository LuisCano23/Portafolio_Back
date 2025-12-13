const pool = require('../config/database');

class Referencia {
  // Obtener todas las referencias
  static async getAll() {
    try {
      const query = `
        SELECT id, nombre, titulo, correo, carta, 
               TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada
        FROM referencias 
        ORDER BY fecha DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error en Referencia.getAll:', error.message);
      throw error;
    }
  }

  // Obtener una referencia por ID
  static async getById(id) {
    try {
      const query = `
        SELECT id, nombre, titulo, correo, carta, 
               TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada
        FROM referencias 
        WHERE id = $1
      `;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Referencia.getById:', error.message);
      throw error;
    }
  }

  // Crear una nueva referencia
  static async create(referenciaData) {
    try {
      const { nombre, titulo, correo, carta } = referenciaData;
      const query = `
        INSERT INTO referencias (nombre, titulo, correo, carta) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, nombre, titulo, correo, carta,
                  TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha_formateada
      `;
      const values = [nombre, titulo, correo, carta];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error en Referencia.create:', error.message);
      throw error;
    }
  }
}

module.exports = Referencia;