"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

const socket = io(process.env.NEXT_PUBLIC_API_URL);

export default function Registros() {
  const COLUMN_COUNT = 10;

  // Initially, we create two blank rows (with temporary unique ids)
  const [rows, setRows] = useState([
    {
      id: Date.now(), // temporary unique id
      descripcion: "",
      times: Array(COLUMN_COUNT).fill(null),
      observacion: "",
    },
    {
      id: Date.now() + 1,
      descripcion: "",
      times: Array(COLUMN_COUNT).fill(null),
      observacion: "",
    },
  ]);

  useEffect(() => {
    // Request the current records from the server on mount
    socket.emit("get_registros");

    // Listen for the full updated rows list
    socket.on("update_registros", (data) => {
      setRows(data);
    });

    // Clean up on unmount
    return () => {
      socket.off("update_registros");
    };
  }, []);

  const handleSetTime = (rowIndex, timeIndex) => {
    const newRows = [...rows];
    newRows[rowIndex].times[timeIndex] = new Date().toLocaleTimeString(
      "es-ES",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }
    );
    setRows(newRows);
    // Broadcast the updated times for this row
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { times: newRows[rowIndex].times },
    });
  };

  const handleObservationChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { observacion: value },
    });
  };

  const handleDescriptionChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].descripcion = value;
    setRows(newRows);
    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { descripcion: value },
    });
  };

  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];
    // Emit an event to persist (or "guardar") the current row to Firestore
    socket.emit("guardar_registro", {
      id: row.id,
      data: {
        descripcion: row.descripcion,
        times: row.times,
        observacion: row.observacion,
      },
    });
    // Clear the row fields after sending
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      descripcion: "",
      times: Array(COLUMN_COUNT).fill(null),
      observacion: "",
    };
    setRows(newRows);
    Swal.fire({
      position: "top-end",
      icon: "success",
      title: "Registro enviado",
      showConfirmButton: false,
      timer: 1000,
    });
  };

  const handleAddRow = () => {
    // Create a new row with a unique id
    const newRow = {
      id: Date.now(),
      descripcion: "",
      times: Array(COLUMN_COUNT).fill(null),
      observacion: "",
    };
    // Optimistically update local state
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    // Emit event so all clients add this new row
    socket.emit("nuevo_registro", newRow);
  };

  const handleDeleteRow = (rowIndex) => {
    const rowToDelete = rows[rowIndex];
    const updatedRows = rows.filter((_, index) => index !== rowIndex);
    setRows(updatedRows);
    socket.emit("eliminar_registro", rowToDelete.id);
  };

  return (
    <div className="p-6">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex justify-between items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">Registro de Tiempos</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2">Descripción</th>
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
              <td className="border border-gray-300 p-2">
                <input
                  type="text"
                  value={row.descripcion}
                  onChange={(e) =>
                    handleDescriptionChange(rowIndex, e.target.value)
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                  placeholder="Descripción..."
                />
              </td>
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
                  className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:opacity-80"
                  onClick={() => handleSubmit(rowIndex)}
                >
                  Enviar
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded hover:opacity-80"
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
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:opacity-80"
        onClick={handleAddRow}
      >
        Agregar Fila
      </button>
    </div>
  );
}
