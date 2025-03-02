"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

// Initialize the socket
const socket = io(process.env.NEXT_PUBLIC_API_URL);

/**
 * Returns the current time in "es-ES" format (HH:MM:SS.mmm)
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
 * Generates a unique ID (only for temporary usage in the table)
 */
function getUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return Date.now().toString() + "_" + Math.random().toString(36).slice(2);
  }
}

/**
 * Creates a blank row object, including:
 * - A default arrival time
 * - 5 product quantities (helados, copas, gofres, bebidas, crepes)
 * - A matching "pedido" object with exactly those 5 keys
 * - Payment method, turn number, consumption flag, observation, etc.
 */
function createBlankRow() {
  return {
    id: getUniqueId(),
    descripcion: "",
    tiempos: {
      arribo: getCurrentTime(), // automatically filled
      inicioAtencionCaja: null,
      inicioProcesoPago: null,
      finPago: null,
      llamado: null,
      // entregaPedido removed
      ocuparMesa: null,
      liberacionMesa: null,
      pedido: {
        helados: null,
        copas: null,
        gofres: null,
        bebidas: null,
        crepes: null,
      },
    },
    productos: {
      helados: 0,
      copas: 0,
      gofres: 0,
      bebidas: 0,
      crepes: 0,
    },
    metodoPago: "efectivo",
    turnoAsignado: "",
    consumoInterno: false,
    observacion: "",
    isEditing: false,
  };
}

export default function Registros() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    // Fetch existing rows
    socket.emit("get_registros");

    socket.on("update_registros", (data) => {
      setRows((prevRows) =>
        data.map((remoteRow) => {
          const localRow = prevRows.find((r) => r.id === remoteRow.id);
          // If a local row is currently being edited, keep it local
          return localRow && localRow.isEditing ? localRow : remoteRow;
        })
      );
    });

    return () => {
      socket.off("update_registros");
    };
  }, []);

  const setRowEditing = (rowIndex, isEditing) => {
    const newRows = [...rows];
    newRows[rowIndex].isEditing = isEditing;
    setRows(newRows);
  };

  /**
   * Sets a main time field (e.g. finPago, llamado) to the current time
   */
  const handleSetTime = (rowIndex, campoTiempo) => {
    const newRows = [...rows];
    newRows[rowIndex].tiempos[campoTiempo] = getCurrentTime();
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
    });
  };

  /**
   * Sets one of the 5 product-based timers in "pedido" to the current time
   */
  const handleSetPedidoTime = (rowIndex, productKey) => {
    const newRows = [...rows];
    // Ensure the 'pedido' object is present
    if (!newRows[rowIndex].tiempos.pedido) {
      newRows[rowIndex].tiempos.pedido = {
        helados: null,
        copas: null,
        gofres: null,
        bebidas: null,
        crepes: null,
      };
    }
    newRows[rowIndex].tiempos.pedido[productKey] = getCurrentTime();
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { tiempos: newRows[rowIndex].tiempos },
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

  const handleObservationChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].observacion = value;
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { observacion: value },
    });
  };

  const handleMetodoPagoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].metodoPago = value;
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { metodoPago: value },
    });
  };

  const handleTurnoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].turnoAsignado = value;
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { turnoAsignado: value },
    });
  };

  const handleConsumoChange = (rowIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex].consumoInterno = value === "si";
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { consumoInterno: newRows[rowIndex].consumoInterno },
    });
  };

  const handleCantidadChange = (rowIndex, productKey, value) => {
    const newRows = [...rows];
    newRows[rowIndex].productos[productKey] = parseInt(value) || 0;
    setRows(newRows);

    socket.emit("actualizar_registro", {
      id: newRows[rowIndex].id,
      data: { productos: newRows[rowIndex].productos },
    });
  };

  /**
   * Validate and submit row data
   */
  const handleSubmit = (rowIndex) => {
    const row = rows[rowIndex];

    // 1) Validate required times
    //    "entregaPedido" is removed from here
    const requiredTimes = [
      "arribo",
      "inicioAtencionCaja",
      "inicioProcesoPago",
      "finPago",
      "llamado",
      // "entregaPedido" removed
    ];
    const tiemposCompletos = requiredTimes.every(
      (campo) => row.tiempos[campo] !== null
    );
    if (!tiemposCompletos) {
      Swal.fire({
        icon: "warning",
        title: "Faltan tiempos",
        text: "Por favor, asegúrate de que todos los tiempos requeridos estén registrados (excepto ocupar y liberar mesa).",
      });
      return;
    }

    // 2) At least one "pedido" timer must be set
    const pedidoTimers = row.tiempos.pedido || {
      helados: null,
      copas: null,
      gofres: null,
      bebidas: null,
      crepes: null,
    };
    const pedidoTimeSelected = Object.values(pedidoTimers).some(
      (time) => time !== null
    );
    if (!pedidoTimeSelected) {
      Swal.fire({
        icon: "warning",
        title: "Faltan tiempos de pedido",
        text: "Por favor, selecciona al menos un tiempo en los subtimers de pedido.",
      });
      return;
    }

    // 3) At least one product must be > 0
    const tieneProducto = Object.values(row.productos).some(
      (cantidad) => cantidad > 0
    );
    if (!tieneProducto) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Por favor, ingresa al menos 1 producto en alguna categoría.",
      });
      return;
    }

    // 4) Validate coherence between quantity and timers
    //    If quantity > 0, timer must not be null
    //    If quantity = 0, timer must be null
    for (const productKey of Object.keys(row.productos)) {
      const quantity = row.productos[productKey];
      const timer = pedidoTimers[productKey];

      if (quantity > 0 && !timer) {
        Swal.fire({
          icon: "warning",
          title: "Incoherencia en producto y pedido",
          text: `Tienes ${quantity} de "${productKey}", pero no hay hora de pedido para ese producto.`,
        });
        return;
      }
      if (quantity === 0 && timer) {
        Swal.fire({
          icon: "warning",
          title: "Incoherencia en producto y pedido",
          text: `Tienes 0 de "${productKey}", pero se registró una hora de pedido para ese producto.`,
        });
        return;
      }
    }

    // 5) Build data object to send
    const { id, isEditing, ...rest } = row;
    const dataToSend = {
      ...rest,
      productos: { ...row.productos },
    };

    // 6) Remove any leftover "pedido1", "pedido2" keys, etc. from old data
    //    We only keep the 5 product-based keys
    if (dataToSend.tiempos?.pedido) {
      const allowedKeys = ["helados", "copas", "gofres", "bebidas", "crepes"];
      const cleanPedido = {};
      for (const key of allowedKeys) {
        cleanPedido[key] = dataToSend.tiempos.pedido[key] || null;
      }
      dataToSend.tiempos.pedido = cleanPedido;
    }

    // 7) Automatically add day of week
    const dayOfWeek = new Date().toLocaleString("es-ES", { weekday: "long" });
    dataToSend.diaSemana = dayOfWeek;

    // 8) Send to Firestore
    socket.emit("guardar_registro", { data: dataToSend });

    // 9) Remove row from local state
    const newRows = rows.filter((_, index) => index !== rowIndex);
    setRows(newRows);

    // 10) Inform other clients
    socket.emit("eliminar_registro", id);

    Swal.fire({
      icon: "success",
      title: "Registro enviado",
      showConfirmButton: false,
      timer: 1000,
    });
  };

  // Add a new row
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
    socket.emit("nuevo_registro", newRow);
  };

  // Delete row
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
        socket.emit("eliminar_registro", rowToDelete.id);
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

      <h1 className="text-xl font-bold mb-4">Registro de Tiempos</h1>

      <table className="w-full border-separate border-spacing-y-4 border-gray-300">
        <thead className="sticky top-0 z-10 bg-black">
          <tr>
            <th className="border border-gray-300 p-2 sticky left-0 z-50 bg-black">
              Descripción
            </th>
            <th className="border border-gray-300 p-2">Arribo</th>
            <th className="border border-gray-300 p-2">Inicio Atención</th>
            <th className="border border-gray-300 p-2">Inicio Pago</th>
            <th className="border border-gray-300 p-2">Fin Pago</th>
            <th className="border border-gray-300 p-2">Método pago</th>
            <th className="border border-gray-300 p-2">Turno</th>
            <th className="border border-gray-300 p-2">Llamado turno</th>

            {/* Productos (5 inputs, stacked) */}
            <th className="border border-gray-300 p-2">Productos</th>

            {/* Pedido (5 timers, stacked) */}
            <th className="border border-gray-300 p-2">Pedido</th>

            {/* "Entrega" column removed */}
            {/* Ocupar Mesa */}
            <th className="border border-gray-300 p-2">Ocupar Mesa</th>
            {/* Liberar Mesa */}
            <th className="border border-gray-300 p-2">Liberar Mesa</th>
            {/* Consumo */}
            <th className="border border-gray-300 p-2">Consumo</th>
            {/* Observación */}
            <th className="border border-gray-300 p-2">Observación</th>
            {/* Acciones */}
            <th className="border border-gray-300 p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            // Only keep the 5 known keys for "pedido"
            const pedidoTimers = row.tiempos.pedido || {
              helados: null,
              copas: null,
              gofres: null,
              bebidas: null,
              crepes: null,
            };

            return (
              <tr key={row.id} className="text-center mb-2">
                {/* Descripción */}
                <td className="border border-gray-300 p-2 sticky left-0 z-auto bg-black min-w-[120px] h-20">
                  <textarea
                    value={row.descripcion}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleDescriptionChange(rowIndex, e.target.value)
                    }
                    className="w-full h-full border rounded p-1 resize-none overflow-auto"
                    placeholder="Descripción"
                  />
                </td>

                {/* Arribo */}
                <td className="border border-gray-300 p-2 min-w-[110px]">
                  {row.tiempos.arribo || "-"}
                </td>

                {/* Inicio Atención */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "inicioAtencionCaja")}
                >
                  {row.tiempos.inicioAtencionCaja || "-"}
                </td>

                {/* Inicio Pago */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "inicioProcesoPago")}
                >
                  {row.tiempos.inicioProcesoPago || "-"}
                </td>

                {/* Fin Pago */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "finPago")}
                >
                  {row.tiempos.finPago || "-"}
                </td>

                {/* Método pago */}
                <td className="border border-gray-300 p-2 min-w-[110px]">
                  <select
                    value={row.metodoPago}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleMetodoPagoChange(rowIndex, e.target.value)
                    }
                    className="w-full p-1 border rounded text-center bg-black"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                  </select>
                </td>

                {/* Turno */}
                <td className="border border-gray-300 p-2 min-w-[90px]">
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

                {/* Llamado turno */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "llamado")}
                >
                  {row.tiempos.llamado || "-"}
                </td>

                {/* Productos */}
                <td className="border border-gray-300 p-2">
                  <div className="flex flex-col gap-1">
                    {/* Helados */}
                    <div className="flex items-center justify-between">
                      <label className="mr-2 text-sm">Helados:</label>
                      <input
                        type="number"
                        className="w-16 p-1 text-center border rounded"
                        value={row.productos.helados}
                        onChange={(e) =>
                          handleCantidadChange(
                            rowIndex,
                            "helados",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    {/* Copas */}
                    <div className="flex items-center justify-between">
                      <label className="mr-2 text-sm">Copas:</label>
                      <input
                        type="number"
                        className="w-16 p-1 text-center border rounded"
                        value={row.productos.copas}
                        onChange={(e) =>
                          handleCantidadChange(
                            rowIndex,
                            "copas",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    {/* Gofres */}
                    <div className="flex items-center justify-between">
                      <label className="mr-2 text-sm">Gofres:</label>
                      <input
                        type="number"
                        className="w-16 p-1 text-center border rounded"
                        value={row.productos.gofres}
                        onChange={(e) =>
                          handleCantidadChange(
                            rowIndex,
                            "gofres",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    {/* Bebidas */}
                    <div className="flex items-center justify-between">
                      <label className="mr-2 text-sm">Bebidas:</label>
                      <input
                        type="number"
                        className="w-16 p-1 text-center border rounded"
                        value={row.productos.bebidas}
                        onChange={(e) =>
                          handleCantidadChange(
                            rowIndex,
                            "bebidas",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    {/* Crepes */}
                    <div className="flex items-center justify-between">
                      <label className="mr-2 text-sm">Crepes:</label>
                      <input
                        type="number"
                        className="w-16 p-1 text-center border rounded"
                        value={row.productos.crepes}
                        onChange={(e) =>
                          handleCantidadChange(
                            rowIndex,
                            "crepes",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </td>

                {/* Pedido - 5 timers */}
                <td className="border border-gray-300 p-2 min-w-[110px]">
                  <div className="flex flex-col justify-even gap-1">
                    {["helados", "copas", "gofres", "bebidas", "crepes"].map(
                      (productKey) => (
                        <div
                          key={productKey}
                          className="cursor-pointer hover:bg-gray-200 rounded border-1 h-[34px] min-w-[115px] flex items-center p-1 justify-center"
                          onClick={() =>
                            handleSetPedidoTime(rowIndex, productKey)
                          }
                        >
                          {pedidoTimers[productKey] || "-"}
                        </div>
                      )
                    )}
                  </div>
                </td>

                {/* "Entrega" column removed */}

                {/* Ocupar Mesa */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "ocuparMesa")}
                >
                  {row.tiempos.ocuparMesa || "-"}
                </td>

                {/* Liberar Mesa */}
                <td
                  className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[110px]"
                  onClick={() => handleSetTime(rowIndex, "liberacionMesa")}
                >
                  {row.tiempos.liberacionMesa || "-"}
                </td>

                {/* Consumo */}
                <td className="border border-gray-300 p-2">
                  <select
                    value={row.consumoInterno ? "si" : "no"}
                    onFocus={() => setRowEditing(rowIndex, true)}
                    onBlur={() => setRowEditing(rowIndex, false)}
                    onChange={(e) =>
                      handleConsumoChange(rowIndex, e.target.value)
                    }
                    className="w-full p-1 border rounded text-center bg-black"
                  >
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
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
                  <div className="flex">
                    <button
                      className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:opacity-80 flex items-center gap-2 font-bold"
                      onClick={() => handleSubmit(rowIndex)}
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
                      className="bg-red-500 text-white p-2 rounded hover:opacity-80"
                      onClick={() => handleDeleteRow(rowIndex)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 2048 2048"
                      >
                        <path
                          fill="currentColor"
                          d="M1792 384h-128v1472q0 40-15 75t-41 61t-61 41t-75 15H448q-40 0-75-15t-61-41t-41-61t-15-75V384H128V256h512V128q0-27 10-50t27-40t41-28t50-10h384q27 0 50 10t40 27t28 41t10 50v128h512zM768 256h384V128H768zm768 128H384v1472q0 26 19 45t45 19h1024q26 0 45-19t19-45zM768 1664H640V640h128zm256 0H896V640h128zm256 0h-128V640h128z"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:opacity-80 font-bold"
        onClick={handleAddRow}
      >
        Agregar Cliente
      </button>
    </div>
  );
}
