"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

const socket = io(process.env.NEXT_PUBLIC_API_URL);

// Definimos el orden y etiquetas de los tiempos a mostrar
const tiemposOrder = [
  { key: "arribo", label: "Arribo" },
  { key: "inicioAtencionCaja", label: "Inicio Atención" },
  { key: "inicioProcesoPago", label: "Inicio Pago" },
  { key: "finPago", label: "Fin Pago" },
  { key: "llamado", label: "Llamado turno" },
  { key: "entregaPedido", label: "Entrega" },
  { key: "ocuparMesa", label: "Ocupar Mesa" },
  { key: "liberacionMesa", label: "Liberar Mesa" },
];

export default function Registros() {
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    // Solicitamos los registros persistidos al servidor
    socket.emit("get_persisted_registros");

    socket.on("update_persisted_registros", (data) => {
      setRegistros(data);
    });

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
      // Emitimos el evento para eliminar el registro en Firestore
      socket.emit("eliminar_registro_persistido", id);
      Swal.fire("Eliminado", "Registro eliminado con éxito", "success");
    }
  };

  return (
    <div className="p-6 overflow-auto">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">Lista de Registros</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2">N° Cliente</th>
              {tiemposOrder.map((t) => (
                <th key={t.key} className="border border-gray-300 p-2">
                  {t.label}
                </th>
              ))}
              <th className="border border-gray-300 p-2">Descripción</th>
              <th className="border border-gray-300 p-2">Turno</th>
              <th className="border border-gray-300 p-2">Productos</th>
              <th className="border border-gray-300 p-2">Consumo</th>
              <th className="border border-gray-300 p-2">Observación</th>
              <th className="border border-gray-300 p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro, index) => (
              <tr key={registro.id} className="text-center">
                {/* En vez de mostrar el id, mostramos el número de cliente */}
                <td className="border border-gray-300 p-2">{index + 1}</td>
                {tiemposOrder.map((t) => (
                  <td key={t.key} className="border border-gray-300 p-2">
                    {registro.tiempos && registro.tiempos[t.key]
                      ? registro.tiempos[t.key]
                      : "---"}
                  </td>
                ))}
                <td className="border border-gray-300 p-2">
                  {registro.descripcion || "---"}
                </td>
                <td className="border border-gray-300 p-2">
                  {registro.turnoAsignado || "---"}
                </td>
                <td className="border border-gray-300 p-2">
                  {registro.productos
                    ? Object.entries(registro.productos).map(([key, value]) => (
                        <div key={key}>
                          {key}: {value}
                        </div>
                      ))
                    : "---"}
                </td>
                <td className="border border-gray-300 p-2">
                  {registro.consumoInterno ? "Sí" : "No"}
                </td>
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
    </div>
  );
}
