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
 * Crea una fila en blanco para la página de Productos.
 * - El turno se deja vacío en la UI (y no se guarda en la BD).
 * - Se inicializa el objeto de tiempos.pedido para cada producto con { current: null, pairs: [] }.
 * - Se ha eliminado la propiedad "llamado" de tiempos.
 */
function createBlankRow() {
  return {
    id: getUniqueId(),
    descripcion: "", // Solo para UI (no se guarda)
    tiempos: {
      pedido: {
        helados: { current: null, pairs: [] },
        copas: { current: null, pairs: [] },
        gofres: { current: null, pairs: [] },
        bebidas: { current: null, pairs: [] },
        crepes: { current: null, pairs: [] },
      },
    },
    turnoAsignado: "", // Se usa solo en la UI para mostrar el número
    observacion: "",
    isEditing: false,
  };
}

export default function ProductosPage() {
  const collectionName = "productos";
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

  // Se ha eliminado la función handleSetLlamado, ya que no se requiere "llamado".

  // Registra los tiempos para cada producto:
  // Si "current" es null, se registra el tiempo de inicio;
  // si ya tiene valor, se registra el tiempo de fin, se crea el par y se reinicia "current".
  const handleSetPedidoTime = (rowIndex, productKey) => {
    const newRows = [...rows];
    const pedidoData = newRows[rowIndex].tiempos.pedido;
    if (!pedidoData[productKey]) {
      pedidoData[productKey] = { current: null, pairs: [] };
    }
    const productTimer = pedidoData[productKey];
    if (productTimer.current === null) {
      productTimer.current = getCurrentTime();
    } else {
      const startTime = productTimer.current;
      const endTime = getCurrentTime();
      productTimer.pairs.push({ inicio: startTime, fin: endTime });
      productTimer.current = null;
    }
    setRows(newRows);
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  // Permite eliminar un par de tiempos para un producto.
  const handleRemovePair = (rowIndex, productKey, pairIndex) => {
    const newRows = [...rows];
    const productTimer = newRows[rowIndex].tiempos.pedido[productKey];
    if (productTimer && productTimer.pairs) {
      productTimer.pairs.splice(pairIndex, 1);
      setRows(newRows);
      socket.emit(`actualizar_${collectionName}`, {
        id: newRows[rowIndex].id,
        data: { tiempos: newRows[rowIndex].tiempos },
      });
    }
  };

  // Actualiza el turno en la UI (no se guarda en la BD).
  const handleTurnoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].turnoAsignado = value.trim();
    setRows(newRows);
    socket.emit(`actualizar_${collectionName}`, {
      id: newRows[rowIndex].id,
      data: { turnoAsignado: newRows[rowIndex].turnoAsignado },
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

  // Al enviar, se construye un objeto aplanado que guarda:
  // diaSemana y, para cada producto, su arreglo de pares, y observacion.
  // El turno no se envía.
  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];
    const pedidoTimers = row.tiempos.pedido;
    const hasPairs = Object.keys(pedidoTimers).some(
      (key) => pedidoTimers[key].pairs.length > 0
    );
    if (!hasPairs) {
      Swal.fire({
        icon: "warning",
        title: "Faltan tiempos de preparación",
        text: "Registra al menos un par de tiempos para la preparación de algún producto.",
      });
      return;
    }
    const dayOfWeek = new Date().toLocaleString("es-ES", { weekday: "long" });
    const allowedKeys = ["helados", "copas", "gofres", "bebidas", "crepes"];
    const dataToSend = {
      diaSemana: dayOfWeek,
      observacion: row.observacion,
    };
    allowedKeys.forEach((key) => {
      dataToSend[key] =
        pedidoTimers[key] && pedidoTimers[key].pairs
          ? pedidoTimers[key].pairs
          : [];
    });
    socket.emit(`guardar_${collectionName}`, { id: row.id, data: dataToSend });
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

  // Al agregar una nueva fila, se asigna el turno basado en el último registro si tiene definido un valor numérico; de lo contrario, queda vacío.
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
      <h1 className="text-3xl font-bold mb-8">Registro de Productos</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-4 border-gray-300">
          <thead className="sticky top-0 z-10 bg-black">
            <tr>
              <th className="border border-gray-300 p-2 sticky left-0 bg-black z-20">
                Turno
              </th>
              <th className="border border-gray-300 p-2">Pedido</th>
              <th className="border border-gray-300 p-2">Observación</th>
              <th className="border border-gray-300 p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className="text-center mb-2">
                {/* Turno */}
                <td className="border border-gray-300 p-2 min-w-[90px] max-w-[90px] sticky left-0 bg-black">
                  <input
                    type="text"
                    value={row.turnoAsignado}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleTurnoChange(rowIndex, e.target.value)
                    }
                    className="w-full p-1 border rounded text-center"
                    placeholder="Turno"
                  />
                </td>
                {/* Pedido */}
                <td className="border border-gray-300 p-2 min-w-[200px] max-w-[200px]">
                  <div className="flex flex-col gap-2">
                    {["helados", "copas", "gofres", "bebidas", "crepes"].map(
                      (productKey) => {
                        const productData = (row.tiempos.pedido &&
                          row.tiempos.pedido[productKey]) || {
                          current: null,
                          pairs: [],
                        };
                        return (
                          <div
                            key={productKey}
                            className="bg-black rounded p-2 border-2 border-white h-[85px]"
                          >
                            <div
                              className="cursor-pointer text-center text-base"
                              onClick={() =>
                                handleSetPedidoTime(rowIndex, productKey)
                              }
                            >
                              <div className="text-sm font-bold uppercase">
                                {productData.current ? "● ● ●" : productKey}
                              </div>
                            </div>
                            {productData.pairs.length > 0 && (
                              <div className="mt-1 space-y-1 max-h-[40px] overflow-y-auto">
                                {productData.pairs.map((pair, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-xs bg-gray-800 p-1 rounded"
                                  >
                                    <div className="flex justify-start items-center text-lg font-bold">
                                      {i + 1}
                                      <p className="flex justify-start text-start ml-2 text-xs font-light">
                                        {pair.inicio} - {pair.fin}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleRemovePair(
                                          rowIndex,
                                          productKey,
                                          i
                                        )
                                      }
                                      className="text-red-500 ml-2 text-lg"
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
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
                    placeholder="Observación"
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
