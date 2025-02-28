"use client";

import { useState } from "react";

export default function Home() {
  const [rows, setRows] = useState([
    { id: 1, times: [null, null, null] },
    { id: 2, times: [null, null, null] },
  ]);

  const handleSetTime = (rowIndex, timeIndex) => {
    const newRows = [...rows];
    newRows[rowIndex].times[timeIndex] = new Date().toLocaleTimeString();
    setRows(newRows);
  };

  const handleSubmit = async (row) => {
    try {
      const response = await fetch("https://data-crepes.vercel.app/registros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ times: row.times }),
      });
      if (response.ok) {
        alert("Registro enviado con éxito");
      } else {
        alert("Error al enviar el registro");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error en la solicitud");
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Registro de Tiempos</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2">Campo 1</th>
            <th className="border border-gray-300 p-2">Campo 2</th>
            <th className="border border-gray-300 p-2">Campo 3</th>
            <th className="border border-gray-300 p-2">Enviar</th>
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
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                  onClick={() => handleSubmit(row)}
                >
                  Enviar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
