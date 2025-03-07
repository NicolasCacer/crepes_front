"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

// Inicializar socket
const socket = io(process.env.NEXT_PUBLIC_API_URL);

/**
 * Retorna la hora actual en formato "es-ES" (HH:MM:SS.mmm)
 */
function getCurrentTime() {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/**
 * Genera un ID único (solo para uso temporal en la tabla)
 */
function getUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return Date.now().toString() + "_" + Math.random().toString(36).slice(2);
  }
}

/**
 * Crea una fila en blanco con la estructura simplificada.
 * Se incluyen:
 * - Tiempos: arribo, inicioAtencionCaja, finPedido y finPago.
 * - Método de pago.
 * - Observación (que se guardará).
 * - Descripción (solo para uso en el UI y NO se guarda).
 */
function createBlankRow() {
  return {
    id: getUniqueId(),
    descripcion: "",
    tiempos: {
      arribo: getCurrentTime(),
      inicioAtencionCaja: null,
      finPedido: null,
      finPago: null,
    },
    metodoPago: "efectivo",
    observacion: "",
    isEditing: false,
  };
}

export default function ArriboPage() {
  const collectionName = "arribo";
  const [rows, setRows] = useState([]);

  useEffect(() => {
    socket.emit(`get_${collectionName}`);

    socket.on(`update_${collectionName}`, (data) => {
      setRows((prevRows) =>
        data.map((remoteRow) => {
          const localRow = prevRows.find((r) => r.id === remoteRow.id);
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

  /**
   * Asigna la hora actual a un campo de tiempos y emite el cambio vía socket.
   */
  const handleSetTime = (rowIndex, campoTiempo) => {
    const newRows = [...rows];
    newRows[rowIndex].tiempos[campoTiempo] = getCurrentTime();
    setRows(newRows);

    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  const handleDescriptionChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].descripcion = value;
    setRows(newRows);

    // Se actualiza localmente, pero este campo no se guardará en Firestore.
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { descripcion: value },
    });
  };

  const handleMetodoPagoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].metodoPago = value;
    setRows(newRows);

    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { metodoPago: value },
    });
  };

  const handleObservacionChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);

    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { observacion: value },
    });
  };

  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];

    // Validar que se hayan registrado los tiempos requeridos
    const requiredTimes = [
      "arribo",
      "inicioAtencionCaja",
      "finPedido",
      "finPago",
    ];
    const tiemposCompletos = requiredTimes.every(
      (campo) => row.tiempos[campo] !== null
    );
    if (!tiemposCompletos) {
      Swal.fire({
        icon: "warning",
        title: "Faltan tiempos",
        text: "Asegúrate de que se registren todos los tiempos requeridos.",
      });
      return;
    }

    // Se omite "descripcion" y se aplanan los datos, ordenándolos:
    // día, luego los tiempos, luego el método de pago y por último observación.
    const { id, isEditing, descripcion, tiempos, metodoPago, observacion } =
      row;
    const dayOfWeek = new Date().toLocaleString("es-ES", { weekday: "long" });
    const dataToSend = {
      diaSemana: dayOfWeek,
      arribo: tiempos.arribo,
      inicioAtencionCaja: tiempos.inicioAtencionCaja,
      finPedido: tiempos.finPedido,
      finPago: tiempos.finPago,
      metodoPago: metodoPago,
      observacion: observacion,
    };

    socket.emit(`guardar_${collectionName}`, { id, data: dataToSend });

    const newRows = rows.filter((_, index) => index !== rowIndex);
    setRows(newRows);
    socket.emit(`eliminar_${collectionName}`, id);

    Swal.fire({
      icon: "success",
      title: "Registro enviado",
      showConfirmButton: false,
      timer: 1000,
    });
  };

  const handleAddRow = () => {
    const newRow = createBlankRow();
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
    <div className="p-2 md:p-6 bg-black text-white max-h-[100vh] min-h-[100vh] overflow-y-auto">
      <Link href="/">
        <button className="bg-gray-500 px-3 py-1 mb-4 rounded-lg hover:opacity-80 flex items-center gap-2">
          <FaArrowLeft /> Volver
        </button>
      </Link>
      <h1 className="text-3xl font-bold mb-8">Registro de Arribo</h1>
      <table className="w-full border-separate border-spacing-y-4 border-gray-300">
        <thead className="sticky top-0 z-10 bg-black">
          <tr>
            <th className="border border-gray-300 p-2">Descripción</th>
            <th className="border border-gray-300 p-2">Arribo</th>
            <th className="border border-gray-300 p-2">Inicio Servicio Caja</th>
            <th className="border border-gray-300 p-2">Finalización Pedido</th>
            <th className="border border-gray-300 p-2">Finalización Pago</th>
            <th className="border border-gray-300 p-2">Método Pago</th>
            <th className="border border-gray-300 p-2">Observación</th>
            <th className="border border-gray-300 p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id} className="text-center mb-2">
              <td className="border border-gray-300 p-2">
                <button
                  onClick={() => handleDeleteRow(rowIndex)}
                  className="bg-red-500 text-white w-fit px-2 rounded hover:opacity-80"
                >
                  Eliminar
                </button>
                <textarea
                  value={row.descripcion}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleDescriptionChange(rowIndex, e.target.value)
                  }
                  className="min-w-[60px] h-50 border rounded p-1 resize-none overflow-auto"
                  placeholder="Descripción"
                />
              </td>
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[120px]"
                onClick={() => handleSetTime(rowIndex, "arribo")}
              >
                {row.tiempos.arribo || "-"}
              </td>
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[120px]"
                onClick={() => handleSetTime(rowIndex, "inicioAtencionCaja")}
              >
                {row.tiempos.inicioAtencionCaja || "-"}
              </td>
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[120px]"
                onClick={() => handleSetTime(rowIndex, "finPedido")}
              >
                {row.tiempos.finPedido || "-"}
              </td>
              <td
                className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[120px]"
                onClick={() => handleSetTime(rowIndex, "finPago")}
              >
                {row.tiempos.finPago || "-"}
              </td>
              <td className="border border-gray-300 p-2 min-w-[120px]">
                <select
                  value={row.metodoPago}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleMetodoPagoChange(rowIndex, e.target.value)
                  }
                  className="w-full p-1 border rounded text-center bg-black min-w-[120px]"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="bono">Bono</option>
                  <option value="digital">Digital</option>
                  <option value="otro">Otro</option>
                </select>
              </td>
              <td className="border border-gray-300 p-2">
                <textarea
                  value={row.observacion}
                  onFocus={() => setRowEditing(rowIndex, true)}
                  onBlur={() => setRowEditing(rowIndex, false)}
                  onChange={(e) =>
                    handleObservacionChange(rowIndex, e.target.value)
                  }
                  className="w-full h-50 border rounded p-1 resize-none overflow-auto min-w-[120px]"
                  placeholder="Observación"
                />
              </td>
              <td className="border border-gray-300 p-2">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => handleSubmit(rowIndex)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:opacity-80 flex items-center gap-2 font-bold"
                  >
                    Enviar
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
      <button
        onClick={handleAddRow}
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:opacity-80 font-bold"
      >
        Agregar Registro
      </button>
    </div>
  );
}
