"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

const socket = io(process.env.NEXT_PUBLIC_API_URL);

export default function Registros() {
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    // Request persisted registros from the server on mount.
    socket.emit("get_persisted_registros");

    // Listen for updates.
    socket.on("update_persisted_registros", (data) => {
      setRegistros(data);
    });

    // Clean up on unmount.
    return () => {
      socket.off("update_persisted_registros");
    };
  }, []);

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (confirm.isConfirmed) {
      // Emit socket event to delete the record from Firestore.
      socket.emit("eliminar_registro_persistido", id);
      Swal.fire("Eliminado", "Registro eliminado con éxito", "success");
    }
  };

  return (
    <div className="p-6">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex justify-between items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">Lista de Registros</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2">ID</th>
            {[...Array(10).keys()].map((i) => (
              <th key={i} className="border border-gray-300 p-2">
                Tiempo {i + 1}
              </th>
            ))}
            <th className="border border-gray-300 p-2">Observación</th>
            <th className="border border-gray-300 p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id} className="text-center">
              <td className="border border-gray-300 p-2">{registro.id}</td>
              {registro.times.map((time, index) => (
                <td key={index} className="border border-gray-300 p-2">
                  {time || "---"}
                </td>
              ))}
              <td className="border border-gray-300 p-2">
                {registro.observacion || "---"}
              </td>
              <td className="border border-gray-300 p-2">
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => handleDelete(registro.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
