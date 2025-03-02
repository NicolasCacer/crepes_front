"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

const socket = io(process.env.NEXT_PUBLIC_API_URL);

// Define the order and labels for the main time fields to display
// "entregaPedido" has been removed from this array.
const tiemposOrder = [
  { key: "arribo", label: "Arribo" },
  { key: "inicioAtencionCaja", label: "Inicio Atención" },
  { key: "inicioProcesoPago", label: "Inicio Pago" },
  { key: "finPago", label: "Fin Pago" },
  { key: "llamado", label: "Llamado turno" },
  { key: "ocuparMesa", label: "Ocupar Mesa" },
  { key: "liberacionMesa", label: "Liberar Mesa" },
];

// Helper to parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" into total milliseconds
function parseArriboTime(timeStr) {
  if (!timeStr) return 0;
  const normalized = timeStr.replace(",", "."); // e.g. "18:32:43,104" -> "18:32:43.104"
  const [h, m, sMs] = normalized.split(":");
  let seconds = 0;
  let milliseconds = 0;
  if (sMs.includes(".")) {
    const [secStr, msStr] = sMs.split(".");
    seconds = parseInt(secStr, 10) || 0;
    // Ensure we parse up to 3 digits of milliseconds
    milliseconds = parseInt(msStr.padEnd(3, "0"), 10) || 0;
  } else {
    seconds = parseInt(sMs, 10) || 0;
  }
  const hours = parseInt(h, 10) || 0;
  const minutes = parseInt(m, 10) || 0;
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

export default function Registros() {
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    // Request persisted records from the server
    socket.emit("get_persisted_registros");

    socket.on("update_persisted_registros", (data) => {
      setRegistros(data);
    });

    return () => {
      socket.off("update_persisted_registros");
    };
  }, []);

  // Sort records by the "arribo" time (older on top)
  const sortedRegistros = [...registros].sort((a, b) => {
    const timeA =
      a.tiempos && a.tiempos.arribo ? parseArriboTime(a.tiempos.arribo) : 0;
    const timeB =
      b.tiempos && b.tiempos.arribo ? parseArriboTime(b.tiempos.arribo) : 0;
    return timeA - timeB;
  });

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
      // Emit event to delete the record from Firestore
      socket.emit("eliminar_registro_persistido", id);
      Swal.fire("Eliminado", "Registro eliminado con éxito", "success");
    }
  };

  return (
    <div className="p-6 overflow-auto bg-black text-white">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">Lista de Registros</h1>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="sticky top-0 z-10 bg-black">
            <tr>
              {/* Sticky first column: N° Cliente */}
              <th className="border border-gray-300 p-2 sticky left-0 z-50 bg-black min-w-[50px]">
                N° Cliente
              </th>
              {/* Main time fields */}
              {tiemposOrder.map((t) => (
                <th key={t.key} className="border border-gray-300 p-2">
                  {t.label}
                </th>
              ))}
              <th className="border border-gray-300 p-2">Descripción</th>
              <th className="border border-gray-300 p-2">Método pago</th>
              <th className="border border-gray-300 p-2">Turno</th>
              <th className="border border-gray-300 p-2">Productos</th>

              {/* Column for the 5 "pedido" timers */}
              <th className="border border-gray-300 p-2">Pedido</th>

              <th className="border border-gray-300 p-2">Consumo</th>
              <th className="border border-gray-300 p-2">Día</th>
              <th className="border border-gray-300 p-2">Observación</th>
              <th className="border border-gray-300 p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedRegistros.map((registro, index) => (
              <tr key={registro.id} className="text-center">
                {/* Sticky first column: index as "N° Cliente" */}
                <td className="border border-gray-300 p-2 sticky left-0 z-50 bg-black">
                  {index + 1}
                </td>

                {/* Show each main time field */}
                {tiemposOrder.map((t) => (
                  <td key={t.key} className="border border-gray-300 p-2">
                    {registro.tiempos && registro.tiempos[t.key]
                      ? registro.tiempos[t.key]
                      : "-"}
                  </td>
                ))}

                {/* Descripción */}
                <td className="border border-gray-300 p-2">
                  {registro.descripcion || "-"}
                </td>

                {/* Método de pago */}
                <td className="border border-gray-300 p-2">
                  {registro.metodoPago || "-"}
                </td>

                {/* Turno */}
                <td className="border border-gray-300 p-2">
                  {registro.turnoAsignado || "-"}
                </td>

                {/* Productos */}
                <td className="border border-gray-300 p-2">
                  {registro.productos
                    ? Object.entries(registro.productos).map(([key, value]) => (
                        <div key={key} className="flex">
                          {key}: {value}
                        </div>
                      ))
                    : "-"}
                </td>

                {/* Pedido - the 5 named timers (helados, copas, gofres, bebidas, crepes) */}
                <td className="border border-gray-300 p-2">
                  {registro.tiempos && registro.tiempos.pedido ? (
                    <ul className="list-none p-0 m-0">
                      {Object.entries(registro.tiempos.pedido).map(
                        ([productKey, timerVal]) => (
                          <li key={productKey} className="flex justify-between">
                            {timerVal || "-"}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    "-"
                  )}
                </td>

                {/* ConsumoInterno */}
                <td className="border border-gray-300 p-2">
                  {registro.consumoInterno ? "Sí" : "No"}
                </td>

                {/* Día de la semana */}
                <td className="border border-gray-300 p-2">
                  {registro.diaSemana || "-"}
                </td>

                {/* Observación */}
                <td className="border border-gray-300 p-2 max-w-[100px] overflow-auto whitespace-pre-wrap">
                  {registro.observacion || "-"}
                </td>

                {/* Acciones */}
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
