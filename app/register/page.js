"use client";

import { useState } from "react";
import Swal from "sweetalert2";

export default function Registros() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const COLUMN_COUNT = 10; // 10 columnas de tiempos

  const [rows, setRows] = useState([
    { id: 1, times: Array(COLUMN_COUNT).fill(null), observacion: "" },
    { id: 2, times: Array(COLUMN_COUNT).fill(null), observacion: "" },
  ]);

  const handleSetTime = (rowIndex, timeIndex) => {
    const newRows = [...rows];
    newRows[rowIndex].times[timeIndex] = new Date().toLocaleTimeString(
      "es-ES",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3, // Agrega milisegundos
      }
    );
    setRows(newRows);
  };

  const handleObservationChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);
  };

  const handleSubmit = async (rowIndex) => {
    try {
      const response = await fetch(`${API_URL}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          times: rows[rowIndex].times,
          observacion: rows[rowIndex].observacion,
        }),
      });

      if (response.ok) {
        // Limpiar los campos después del envío
        const newRows = [...rows];
        newRows[rowIndex].times = Array(COLUMN_COUNT).fill(null);
        newRows[rowIndex].observacion = "";
        setRows(newRows);

        // Mostrar mensaje de éxito con SweetAlert2
        Swal.fire({
          position: "top-end",
          icon: "success",
          title: "Registro enviado",
          showConfirmButton: false,
          timer: 1000, // Alerta corta
        });
      } else {
        Swal.fire("Error", "No se pudo enviar el registro", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire("Error", "Hubo un problema con la solicitud", "error");
    }
  };

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: rows.length + 1,
        times: Array(COLUMN_COUNT).fill(null),
        observacion: "",
      },
    ]);
  };

  const handleDeleteRow = (rowIndex) => {
    setRows(rows.filter((_, index) => index !== rowIndex));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Registro de Tiempos</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            {Array.from({ length: COLUMN_COUNT }).map((_, index) => (
              <th key={index} className="border border-gray-300 p-2">
                Campo {index + 1}
              </th>
            ))}
            <th className="border border-gray-300 p-2">Observación</th>
            <th className="border border-gray-300 p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id} className="text-center">
              {row.times.map((time, timeIndex) => (
                <td
                  key={timeIndex}
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSetTime(rowIndex, timeIndex)}
                >
                  {time || "---"}
                </td>
              ))}
              <td className="border border-gray-300 p-2">
                <input
                  type="text"
                  value={row.observacion}
                  onChange={(e) =>
                    handleObservationChange(rowIndex, e.target.value)
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                  placeholder="Escribir..."
                />
              </td>
              <td className="border border-gray-300 p-2">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
                  onClick={() => handleSubmit(rowIndex)}
                >
                  Enviar
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => handleDeleteRow(rowIndex)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded"
        onClick={handleAddRow}
      >
        Agregar Fila
      </button>
    </div>
  );
}
