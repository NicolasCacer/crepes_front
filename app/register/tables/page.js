"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

// Inicializar socket
const socket = io(process.env.NEXT_PUBLIC_API_URL);

function getCurrentTime() {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function getUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return Date.now().toString() + "_" + Math.random().toString(36).slice(2);
  }
}

/**
 * Crea una fila en blanco para la página de Mesas.
 * - El turno se deja vacío en la UI (y no se guarda en la BD).
 * - Solo se registran los tiempos en que se ocupó y liberó la mesa.
 * - Se incluye un campo "consumoInterno" para indicar si el cliente consume en el local.
 */
function createBlankRow() {
  return {
    id: getUniqueId(),
    descripcion: "", // Solo para uso en UI
    tiempos: {
      ocuparMesa: null,
      liberacionMesa: null,
    },
    consumoInterno: false,
    observacion: "",
    turnoAsignado: "", // Se usa solo en la UI (columna fija)
    isEditing: false,
  };
}

export default function MesasPage() {
  const collectionName = "mesas";
  const [rows, setRows] = useState([]);

  useEffect(() => {
    socket.emit(`get_${collectionName}`);
    socket.on(`update_${collectionName}`, (data) => {
      setRows((prevRows) =>
        data.map((remoteRow) => {
          const localRow = prevRows.find((r) => r.id === remoteRow.id);
          // Si está en edición local, no pisarlo con los datos del servidor
          return localRow && localRow.isEditing ? localRow : remoteRow;
        })
      );
    });
    return () => {
      socket.off(`update_${collectionName}`);
    };
  }, [collectionName]);

  const setRowEditing = (rowIndex, isEditing) => {
    const newRows = [...rows];
    newRows[rowIndex].isEditing = isEditing;
    setRows(newRows);
  };

  // --------------------------------------------------------------------------------
  // 1) Evitar setear tiempos si no hay consumo
  // --------------------------------------------------------------------------------
  const handleSetOcuparMesa = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row.consumoInterno) {
      Swal.fire({
        icon: "info",
        title: "No se puede asignar tiempo",
        text: "Esta mesa no es para consumo interno.",
      });
      return;
    }
    const newRows = [...rows];
    newRows[rowIndex].tiempos.ocuparMesa = getCurrentTime();
    setRows(newRows);

    // Actualiza en el servidor
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  const handleSetLiberacionMesa = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row.consumoInterno) {
      Swal.fire({
        icon: "info",
        title: "No se puede asignar tiempo",
        text: "Esta mesa no es para consumo interno.",
      });
      return;
    }
    const newRows = [...rows];
    newRows[rowIndex].tiempos.liberacionMesa = getCurrentTime();
    setRows(newRows);

    // Actualiza en el servidor
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  // --------------------------------------------------------------------------------
  // 2) Si el usuario cambia a "No" consumo, se borran los tiempos
  // --------------------------------------------------------------------------------
  const handleConsumoChange = (rowIndex, value) => {
    const newRows = [...rows];
    const isConsumo = value === "si";

    newRows[rowIndex].consumoInterno = isConsumo;

    // Si NO hay consumo, limpiamos los tiempos
    if (!isConsumo) {
      newRows[rowIndex].tiempos.ocuparMesa = null;
      newRows[rowIndex].tiempos.liberacionMesa = null;
    }

    setRows(newRows);
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: {
        consumoInterno: isConsumo,
        tiempos: newRows[rowIndex].tiempos,
      },
    });
  };

  const handleDescriptionChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].descripcion = value;
    setRows(newRows);
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { descripcion: value },
    });
  };

  const handleObservationChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { observacion: value },
    });
  };

  // --------------------------------------------------------------------------------
  // 3) Validar antes de "Enviar":
  //    - Si hay consumo, requerir ambos tiempos
  //    - Si NO hay consumo, no deben existir tiempos
  // --------------------------------------------------------------------------------
  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];

    if (row.consumoInterno) {
      // Consumió en el local -> se necesitan ambos tiempos
      if (!row.tiempos.ocuparMesa || !row.tiempos.liberacionMesa) {
        Swal.fire({
          icon: "warning",
          title: "Faltan tiempos",
          text: "Como el cliente consume en el local, registra los tiempos de ocupar y liberar la mesa.",
        });
        return;
      }
    } else {
      // No consumió -> no debe tener tiempos
      if (row.tiempos.ocuparMesa || row.tiempos.liberacionMesa) {
        Swal.fire({
          icon: "warning",
          title: "No deben existir tiempos",
          text: "La mesa no es para consumo interno, no debe tener tiempos asignados.",
        });
        return;
      }
    }

    const dayOfWeek = new Date().toLocaleString("es-ES", { weekday: "long" });
    const dataToSend = {
      diaSemana: dayOfWeek,
      consumoInterno: row.consumoInterno,
      ocuparMesa: row.tiempos.ocuparMesa || "",
      liberacionMesa: row.tiempos.liberacionMesa || "",
      observacion: row.observacion,
    };

    // Guarda en la BD
    socket.emit(`guardar_${collectionName}`, { id: row.id, data: dataToSend });

    // Elimina del estado local y del servidor
    const newRowsFiltered = rows.filter((_, index) => index !== rowIndex);
    setRows(newRowsFiltered);
    socket.emit(`eliminar_${collectionName}`, row.id);

    Swal.fire({
      icon: "success",
      title: "Registro enviado",
      showConfirmButton: false,
      timer: 1000,
    });
  };

  // Al agregar una nueva fila, se asigna el turno basado en el último registro si tiene un valor numérico; de lo contrario, queda vacío.
  const handleAddRow = () => {
    let newTurno = "";
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (lastRow.turnoAsignado && !isNaN(lastRow.turnoAsignado)) {
        newTurno = String(Number(lastRow.turnoAsignado) + 1);
      }
    }
    const newRow = createBlankRow();
    newRow.turnoAsignado = newTurno;
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    socket.emit(`nuevo_${collectionName}`, newRow);
  };

  const handleDeleteRow = (rowIndex) => {
    Swal.fire({
      title: "¿Eliminar fila?",
      text: "Esta acción eliminará la fila de forma permanente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        const rowToDelete = rows[rowIndex];
        const updatedRows = rows.filter((_, index) => index !== rowIndex);
        setRows(updatedRows);
        socket.emit(`eliminar_${collectionName}`, rowToDelete.id);
        Swal.fire("Eliminado", "La fila ha sido eliminada", "success");
      }
    });
  };

  return (
    <div className="p-2 md:p-6 bg-black text-white max-h-[100vh] min-h-[100vh] overflow-auto">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-3xl font-bold mb-8">Registro de Mesas</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-4 border-gray-300">
          <thead className="sticky top-0 z-10 bg-black">
            <tr>
              <th className="border border-gray-300 p-2 sticky left-0 bg-black z-20">
                Descripción
              </th>
              <th className="border border-gray-300 p-2">Consumo</th>
              <th className="border border-gray-300 p-2">Ocupar Mesa</th>
              <th className="border border-gray-300 p-2">Liberar Mesa</th>
              <th className="border border-gray-300 p-2">Observación</th>
              <th className="border border-gray-300 p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className="text-center mb-2">
                {/* Descripción */}
                <td className="border border-gray-300 p-2 sticky left-0 bg-black">
                  <textarea
                    value={row.descripcion}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleDescriptionChange(rowIndex, e.target.value)
                    }
                    className="w-full border rounded p-1 resize-none overflow-auto min-w-[120px] h-40"
                    placeholder="Descripción"
                  />
                </td>

                {/* Consumo */}
                <td className="border border-gray-300 p-2 min-w-[110px]">
                  <select
                    value={row.consumoInterno ? "si" : "no"}
                    onChange={(e) =>
                      handleConsumoChange(rowIndex, e.target.value)
                    }
                    className="w-full p-1 border rounded text-center bg-black"
                  >
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </td>

                {/* Ocupar Mesa */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetOcuparMesa(rowIndex)}
                >
                  {row.tiempos.ocuparMesa || ""}
                </td>

                {/* Liberar Mesa */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetLiberacionMesa(rowIndex)}
                >
                  {row.tiempos.liberacionMesa || ""}
                </td>

                {/* Observación */}
                <td className="border border-gray-300 p-2 min-w-[150px] h-20">
                  <textarea
                    value={row.observacion}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleObservationChange(rowIndex, e.target.value)
                    }
                    className="w-full h-full border rounded p-1 resize-none overflow-auto"
                    placeholder="Observaciones"
                  />
                </td>

                {/* Acciones */}
                <td className="border border-gray-300 p-2">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => handleSubmit(rowIndex)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:opacity-80 flex items-center gap-2 font-bold"
                    >
                      Enviar
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 15 15"
                      >
                        <path
                          fill="currentColor"
                          d="m14.5.5l.46.197a.5.5 0 0 0-.657-.657zm-14 6l-.197-.46a.5.5 0 0 0-.06.889zm8 8l-.429.257a.5.5 0 0 0 .889-.06zM14.303.04l-14 6l.394.92l14-6zM.243 6.93l5 3l.514-.858l-5-3zM5.07 9.757l3 5l.858-.514l-3-5zm3.889 4.94l6-14l-.92-.394l-6 14zM14.146.147l-9 9l.708.707l9-9z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="bg-red-500 text-white p-2 rounded hover:opacity-80"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleAddRow}
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:opacity-80 font-bold"
      >
        Agregar Registro
      </button>
    </div>
  );
}
