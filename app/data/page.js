"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

export default function Registros() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    try {
      const response = await fetch(`${API_URL}/registros`);
      const data = await response.json();
      setRegistros(data);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

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
      try {
        await fetch(`${API_URL}/registros/${id}`, {
          method: "DELETE",
        });
        setRegistros(registros.filter((registro) => registro.id !== id));
        Swal.fire("Eliminado", "Registro eliminado con éxito", "success");
      } catch (error) {
        console.error("Error deleting record:", error);
      }
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
