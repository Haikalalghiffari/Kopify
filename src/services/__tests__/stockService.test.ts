import { PrismaClient, StockMovementType } from "@prisma/client";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { StockService } from "../stockService";
import {
  AdjustStockParams,
  CommitReservationParams,
  ReleaseStockParams,
  ReserveStockParams,
} from "../contracts";

// Konfigurasi koneksi ke database khusus pengujian (test database)
const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL?.replace(/\/koperasi_db(\?|$)/, "/koperasi_test_db$1") ||
  "postgresql://koperasi_user:koperasi_pass@localhost:5433/koperasi_test_db?schema=public";

// Safety guard ketat: HANYA izinkan database "koperasi_test_db" tanpa bergantung pada NODE_ENV
const parsedUrl = new URL(testDbUrl);
const dbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0].toLowerCase();

if (dbName !== "koperasi_test_db") {
  throw new Error(
    `SAFETY CHECK GAGAL: Integration test hanya diizinkan berjalan pada database "koperasi_test_db". Database terdeteksi: "${dbName}". Pengujian dihentikan sebelum inisialisasi koneksi untuk mencegah manipulasi atau penghapusan data di luar database khusus pengujian.`
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

// Instansiasi StockService dengan PrismaClient khusus test database
const stockService = new StockService(prisma);

// Helpers untuk membuat data pengujian terisolasi
let idCounter = 0;
const getUniqueId = (prefix: string) =>
  `${prefix}-${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 7)}`;

const createUser = async (id?: string) => {
  const userId = id || getUniqueId("user");
  return await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      username: `u-${userId}`,
      passwordHash: "hashed_test_password",
    },
  });
};

const createMember = async () => {
  const uid = getUniqueId("mem");
  return await prisma.member.create({
    data: {
      memberNo: `ANG-${uid}`,
      name: `Member ${uid}`,
    },
  });
};

const createOrder = async (orderId?: string) => {
  const finalOrderId = orderId || getUniqueId("ord");
  const member = await createMember();
  return await prisma.order.create({
    data: {
      id: finalOrderId,
      orderNo: `ORD-${Date.now()}-${++idCounter}`,
      member: { connect: { id: member.id } },
      status: "DIAJUKAN",
    },
  });
};

const createProduct = async (
  stock: number,
  reservedStock = 0,
  minStock = 5
) => {
  const uid = getUniqueId("p");
  const category = await prisma.category.create({
    data: { name: `Cat-${uid}` },
  });
  const unit = await prisma.unit.create({
    data: { name: `Unit-${uid}` },
  });

  return await prisma.product.create({
    data: {
      name: `Test Product ${uid}`,
      sku: `SKU-${uid}`,
      stock,
      reservedStock,
      minStock,
      costPrice: 8000,
      sellPrice: 10000,
      categoryId: category.id,
      unitId: unit.id,
      isActive: true,
    },
  });
};

describe("StockService Integration Tests (PostgreSQL Dedicated Test DB)", () => {
  let defaultUser: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    defaultUser = await createUser();
  });

  afterEach(async () => {
    // Bersihkan data yang dibuat selama pengujian pada test database
    await prisma.stockReservation.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.member.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Pastikan koneksi Prisma ditutup setelah seluruh pengujian selesai
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. ADJUSTMENT STOK DAN VALIDASI STOK NEGATIF
  // =========================================================================
  describe("1. Adjustment stok dan validasi stok negatif", () => {
    it("menambah dan mengurangi stok dengan benar serta mencatat pergerakan stok", async () => {
      const product = await createProduct(10);

      // Tambah stok (+5)
      const incParams: AdjustStockParams = {
        productId: product.id,
        qtyChange: 5,
        type: StockMovementType.PURCHASE,
        refType: "PURCHASE",
        refId: "ref-inc-1",
        note: "Penerimaan barang masuk",
        userId: defaultUser.id,
      };
      const incResult = await stockService.adjustStock(incParams);
      expect(incResult.stockBefore).toBe(10);
      expect(incResult.stockAfter).toBe(15);
      expect(incResult.qtyChange).toBe(5);

      const productAfterInc = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(productAfterInc.stock).toBe(15);

      // Kurangi stok (-8)
      const decParams: AdjustStockParams = {
        productId: product.id,
        qtyChange: -8,
        type: StockMovementType.ADJUSTMENT,
        refType: "ADJUSTMENT",
        refId: "ref-dec-1",
        note: "Penyesuaian stok rusak",
        userId: defaultUser.id,
      };
      const decResult = await stockService.adjustStock(decParams);
      expect(decResult.stockBefore).toBe(15);
      expect(decResult.stockAfter).toBe(7);

      const productAfterDec = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(productAfterDec.stock).toBe(7);
    });

    it("menolak adjustment yang menyebabkan stok fisik bernilai negatif", async () => {
      const product = await createProduct(5);

      await expect(
        stockService.adjustStock({
          productId: product.id,
          qtyChange: -10, // 5 - 10 = -5 (< 0)
          type: StockMovementType.ADJUSTMENT,
          note: "Pengurangan berlebih",
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/Stok tersedia tidak cukup/);

      // Pastikan stok tidak berubah di database
      const unchanged = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(unchanged.stock).toBe(5);
    });

    it("menolak adjustment jika stok fisik turun di bawah reservedStock", async () => {
      // Stok fisik 10, namun 7 sudah tercadangkan untuk pesanan aktif
      const product = await createProduct(10, 7);

      await expect(
        stockService.adjustStock({
          productId: product.id,
          qtyChange: -5, // 10 - 5 = 5 (< reservedStock 7)
          type: StockMovementType.ADJUSTMENT,
          note: "Pengurangan melebihi stok bebas",
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/Stok tersedia tidak cukup/);

      const unchanged = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(unchanged.stock).toBe(10);
    });

    it("menolak adjustment jika qtyChange adalah 0 atau bukan integer aman", async () => {
      const product = await createProduct(10);

      await expect(
        stockService.adjustStock({
          productId: product.id,
          qtyChange: 0,
          type: StockMovementType.ADJUSTMENT,
          note: "Nol change",
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/selain 0/);

      await expect(
        stockService.adjustStock({
          productId: product.id,
          qtyChange: 2.5,
          type: StockMovementType.ADJUSTMENT,
          note: "Pecahan",
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/bilangan bulat/);
    });
  });

  // =========================================================================
  // 2. TRANSAKSI EKSTERNAL BERHASIL
  // =========================================================================
  describe("2. Transaksi eksternal berhasil", () => {
    it("mengeksekusi adjustStock dan reserve menggunakan transaksi eksternal yang sukses commit", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      await prisma.$transaction(async (tx) => {
        // 1. Jalankan adjustStock dengan tx eksternal
        await stockService.adjustStock(
          {
            productId: product.id,
            qtyChange: 10, // 20 -> 30
            type: StockMovementType.PURCHASE,
            note: "Barang masuk eksternal",
            userId: defaultUser.id,
          },
          tx
        );

        // 2. Jalankan reserve dengan tx eksternal
        await stockService.reserve(
          {
            productId: product.id,
            qty: 12,
            orderId: order.id,
          },
          tx
        );
      });

      // Verifikasi di luar transaksi bahwa kedua perubahan tersimpan permanen
      const updatedProduct = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(updatedProduct.stock).toBe(30);
      expect(updatedProduct.reservedStock).toBe(12);

      const reservation = await prisma.stockReservation.findFirst({
        where: { orderId: order.id, productId: product.id },
      });
      expect(reservation).toBeTruthy();
      expect(reservation?.remainingQty).toBe(12);
      expect(reservation?.status).toBe("ACTIVE");
    });
  });

  // =========================================================================
  // 3. ROLLBACK KETIKA TRANSAKSI INDUK GAGAL
  // =========================================================================
  describe("3. Rollback ketika transaksi induk gagal", () => {
    it("mengembalikan semua perubahan stok jika transaksi induk melempar error", async () => {
      const product = await createProduct(20, 0);
      const order = await createOrder();

      const transactionPromise = prisma.$transaction(async (tx) => {
        // Operasi 1: adjustStock lewat tx
        await stockService.adjustStock(
          {
            productId: product.id,
            qtyChange: 15,
            type: StockMovementType.PURCHASE,
            note: "Tambah sementara",
            userId: defaultUser.id,
          },
          tx
        );

        // Operasi 2: reserve lewat tx
        await stockService.reserve(
          {
            productId: product.id,
            qty: 5,
            orderId: order.id,
          },
          tx
        );

        // Simulasi error mendadak di transaksi induk (misal: pembayaran gagal)
        throw new Error("Simulasi kegagalan transaksi induk");
      });

      await expect(transactionPromise).rejects.toThrow(
        "Simulasi kegagalan transaksi induk"
      );

      // Verifikasi bahwa seluruh perubahan di-rollback
      const rolledBackProduct = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(rolledBackProduct.stock).toBe(20);
      expect(rolledBackProduct.reservedStock).toBe(0);

      // Tidak ada stockReservation dan movement yang tersisa
      const reservations = await prisma.stockReservation.findMany({
        where: { orderId: order.id },
      });
      expect(reservations).toHaveLength(0);

      const movements = await prisma.stockMovement.findMany({
        where: { productId: product.id },
      });
      expect(movements).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. RESERVASI GANDA
  // =========================================================================
  describe("4. Reservasi ganda", () => {
    it("menolak reservasi aktif ganda untuk produk yang sama pada pesanan yang sama", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      // Reservasi pertama berhasil
      await stockService.reserve({
        productId: product.id,
        qty: 5,
        orderId: order.id,
      });

      // Reservasi kedua untuk produk & pesanan yang sama harus ditolak
      await expect(
        stockService.reserve({
          productId: product.id,
          qty: 3,
          orderId: order.id,
        })
      ).rejects.toThrow(/Reservasi aktif untuk barang/);

      // reservedStock tetap 5, tidak bertambah menjadi 8
      const productState = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(productState.reservedStock).toBe(5);
    });
  });

  // =========================================================================
  // 5. RESERVASI MELEBIHI STOK TERSEDIA
  // =========================================================================
  describe("5. Reservasi melebihi stok tersedia", () => {
    it("menolak reservasi jika kuantitas melebihi stok yang tersedia (stock - reservedStock)", async () => {
      // Stok fisik 10, sudah dicadangkan 7 -> tersedia hanya 3
      const product = await createProduct(10, 7);
      const order = await createOrder();

      await expect(
        stockService.reserve({
          productId: product.id,
          qty: 4, // 4 > 3
          orderId: order.id,
        })
      ).rejects.toThrow(/Stok tersedia tidak cukup/);

      const unchanged = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(unchanged.reservedStock).toBe(7);
    });
  });

  // =========================================================================
  // 6. RELEASE SEBAGIAN
  // =========================================================================
  describe("6. Release sebagian", () => {
    it("melepas sebagian kuantitas reservasi dan memperbarui sisa reservasi", async () => {
      const product = await createProduct(25);
      const order = await createOrder();

      // Reservasi awal: 10
      await stockService.reserve({
        productId: product.id,
        qty: 10,
        orderId: order.id,
      });

      // Lepas sebagian: 4
      const releaseParams: ReleaseStockParams = {
        productId: product.id,
        qty: 4,
        orderId: order.id,
      };
      await stockService.release(releaseParams);

      // reservedStock berkurang dari 10 menjadi 6
      const updatedProduct = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(updatedProduct.reservedStock).toBe(6);

      // Status reservasi tetap ACTIVE dengan remainingQty = 6
      const reservation = await prisma.stockReservation.findFirstOrThrow({
        where: { orderId: order.id, productId: product.id },
      });
      expect(reservation.remainingQty).toBe(6);
      expect(reservation.status).toBe("ACTIVE");
    });
  });

  // =========================================================================
  // 7. RELEASE BERULANG
  // =========================================================================
  describe("7. Release berulang", () => {
    it("mendukung release bertahap hingga habis dan menolak jika kuantitas melebihi sisa", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      // Reservasi awal: 8
      await stockService.reserve({
        productId: product.id,
        qty: 8,
        orderId: order.id,
      });

      // Tahap 1: Lepas 3 -> sisa 5
      await stockService.release({
        productId: product.id,
        qty: 3,
        orderId: order.id,
      });
      let prod = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(prod.reservedStock).toBe(5);

      // Tahap 2: Lepas 5 -> sisa 0, status RELEASED
      await stockService.release({
        productId: product.id,
        qty: 5,
        orderId: order.id,
      });
      prod = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(prod.reservedStock).toBe(0);

      const reservation = await prisma.stockReservation.findFirstOrThrow({
        where: { orderId: order.id, productId: product.id },
      });
      expect(reservation.remainingQty).toBe(0);
      expect(reservation.status).toBe("RELEASED");

      // Tahap 3: Coba lepas lagi ketika sudah habis (0) -> Harus ditolak
      await expect(
        stockService.release({
          productId: product.id,
          qty: 1,
          orderId: order.id,
        })
      ).rejects.toThrow(/Reservasi pesanan .* tidak cukup/);
    });
  });

  // =========================================================================
  // 8. COMMIT BERHASIL
  // =========================================================================
  describe("8. Commit berhasil", () => {
    it("mengurangi stok fisik dan reservedStock serta menandai reservasi COMMITTED", async () => {
      const productA = await createProduct(30);
      const productB = await createProduct(20);
      const order = await createOrder();

      // Tambahkan item pesanan: A qty 4, B qty 2
      await prisma.orderItem.createMany({
        data: [
          { orderId: order.id, productId: productA.id, qty: 4, unitPrice: 10000 },
          { orderId: order.id, productId: productB.id, qty: 2, unitPrice: 10000 },
        ],
      });

      // Buat reservasi sesuai item pesanan
      await stockService.reserve({
        productId: productA.id,
        qty: 4,
        orderId: order.id,
      });
      await stockService.reserve({
        productId: productB.id,
        qty: 2,
        orderId: order.id,
      });

      // Jalankan commit
      const commitParams: CommitReservationParams = {
        orderId: order.id,
        userId: defaultUser.id,
      };
      await stockService.commitReservation(commitParams);

      // Verifikasi produk A: stok fisik 30 - 4 = 26, reservedStock 0
      const updatedA = await prisma.product.findUniqueOrThrow({
        where: { id: productA.id },
      });
      expect(updatedA.stock).toBe(26);
      expect(updatedA.reservedStock).toBe(0);

      // Verifikasi produk B: stok fisik 20 - 2 = 18, reservedStock 0
      const updatedB = await prisma.product.findUniqueOrThrow({
        where: { id: productB.id },
      });
      expect(updatedB.stock).toBe(18);
      expect(updatedB.reservedStock).toBe(0);

      // Verifikasi semua reservasi berstatus COMMITTED
      const reservations = await prisma.stockReservation.findMany({
        where: { orderId: order.id },
      });
      expect(reservations).toHaveLength(2);
      expect(reservations.every((r) => r.status === "COMMITTED" && r.remainingQty === 0)).toBe(true);

      // Verifikasi stockMovement ORDER_FULFILLED
      const movements = await prisma.stockMovement.findMany({
        where: { refId: order.id, type: StockMovementType.ORDER_FULFILLED },
      });
      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.createdBy === defaultUser.id)).toBe(true);
    });
  });

  // =========================================================================
  // 9. COMMIT BERULANG TIDAK MENGURANGI STOK DUA KALI (IDEMPOTENSI)
  // =========================================================================
  describe("9. Commit berulang tidak mengurangi stok dua kali (Idempotensi)", () => {
    it("pemanggilan commitReservation kedua untuk pesanan yang sama bersifat idempoten", async () => {
      const product = await createProduct(50);
      const order = await createOrder();

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          qty: 10,
          unitPrice: 10000,
        },
      });

      await stockService.reserve({
        productId: product.id,
        qty: 10,
        orderId: order.id,
      });

      const commitParams: CommitReservationParams = {
        orderId: order.id,
        userId: defaultUser.id,
      };

      // Commit pertama
      await stockService.commitReservation(commitParams);

      const afterFirstCommit = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(afterFirstCommit.stock).toBe(40);
      expect(afterFirstCommit.reservedStock).toBe(0);

      // Commit kedua (pemanggilan ulang)
      await expect(
        stockService.commitReservation(commitParams)
      ).resolves.not.toThrow();

      // Stok fisik TIDAK boleh terpotong lagi (tetap 40)
      const afterSecondCommit = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(afterSecondCommit.stock).toBe(40);
      expect(afterSecondCommit.reservedStock).toBe(0);

      // StockMovement tetap hanya 1
      const movementCount = await prisma.stockMovement.count({
        where: { refId: order.id, type: StockMovementType.ORDER_FULFILLED },
      });
      expect(movementCount).toBe(1);
    });
  });

  // =========================================================================
  // 10. KETIDAKSESUAIAN JUMLAH RESERVASI DENGAN ORDER ITEM
  // =========================================================================
  describe("10. Ketidaksesuaian jumlah reservasi dengan order item", () => {
    it("menolak commit jika jumlah kuantitas reservasi tidak sama dengan order items", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      // Order item minta 5
      await prisma.orderItem.create({
        data: { orderId: order.id, productId: product.id, qty: 5, unitPrice: 10000 },
      });

      // Namun reservasi hanya 3 (tidak sesuai)
      await stockService.reserve({
        productId: product.id,
        qty: 3,
        orderId: order.id,
      });

      await expect(
        stockService.commitReservation({
          orderId: order.id,
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/Reservasi barang .* tidak sesuai/);

      // Stok fisik tidak berkurang
      const productState = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(productState.stock).toBe(20);
      expect(productState.reservedStock).toBe(3);
    });

    it("menolak commit jika jumlah jenis produk yang dicadangkan berbeda dengan pesanan", async () => {
      const productA = await createProduct(20);
      const productB = await createProduct(20);
      const order = await createOrder();

      // Order items memesan 2 macam produk: productA dan productB
      await prisma.orderItem.createMany({
        data: [
          { orderId: order.id, productId: productA.id, qty: 2, unitPrice: 10000 },
          { orderId: order.id, productId: productB.id, qty: 3, unitPrice: 10000 },
        ],
      });

      // Namun yang dicadangkan hanya 1 macam produk: productA
      await stockService.reserve({
        productId: productA.id,
        qty: 2,
        orderId: order.id,
      });

      await expect(
        stockService.commitReservation({
          orderId: order.id,
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/Jumlah reservasi tidak sesuai dengan item pesanan/);
    });

    it("menolak commit jika pesanan tidak memiliki order item", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      // Reservasi dibuat tanpa ada order items di pesanan
      await stockService.reserve({
        productId: product.id,
        qty: 2,
        orderId: order.id,
      });

      await expect(
        stockService.commitReservation({
          orderId: order.id,
          userId: defaultUser.id,
        })
      ).rejects.toThrow(/tidak memiliki barang/);
    });
  });

  // =========================================================================
  // 11. CONCURRENT RESERVATION UNTUK PRODUK YANG SAMA (ROW LOCKING)
  // =========================================================================
  describe("11. Concurrent reservation untuk produk yang sama", () => {
    it("menjamin integritas row locking: hanya satu permintaan yang berhasil jika stok tidak mencukupi", async () => {
      // Stok fisik hanya 5
      const product = await createProduct(5, 0);

      // Dua pesanan bersaing atas produk yang sama secara serentak
      const order1 = await createOrder();
      const order2 = await createOrder();

      // Order 1 meminta 4, Order 2 meminta 3 (Total permintaan 7 > stok 5)
      const reservationPromises = [
        stockService.reserve({
          productId: product.id,
          qty: 4,
          orderId: order1.id,
        }),
        stockService.reserve({
          productId: product.id,
          qty: 3,
          orderId: order2.id,
        }),
      ];

      const results = await Promise.allSettled(reservationPromises);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Tepat 1 operasi berhasil dan tepat 1 operasi ditolak
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Verifikasi konsistensi stok di database: tidak ada race condition
      const finalProduct = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });

      // reservedStock harus tepat bernilai salah satu dari 4 atau 3 (bukan 7!)
      expect([3, 4]).toContain(finalProduct.reservedStock);
      expect(finalProduct.stock).toBe(5);
    });
  });

  // =========================================================================
  // 12. ROLLBACK JIKA SALAH SATU OPERASI DALAM PROSES COMMIT GAGAL
  // =========================================================================
  describe("12. Rollback jika salah satu operasi dalam proses commit gagal", () => {
    it("membatalkan seluruh efek commitReservation jika transaksi eksternal gagal di langkah berikutnya", async () => {
      const product = await createProduct(20);
      const order = await createOrder();

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          qty: 5,
          unitPrice: 10000,
        },
      });

      await stockService.reserve({
        productId: product.id,
        qty: 5,
        orderId: order.id,
      });

      const commitWithExternalFailure = prisma.$transaction(async (tx) => {
        // 1. Eksekusi commitReservation dengan tx eksternal
        await stockService.commitReservation(
          {
            orderId: order.id,
            userId: defaultUser.id,
          },
          tx
        );

        // 2. Operasi bisnis berikutnya dalam transaksi yang sama gagal (misal pencatatan penjualan atau integrasi kasir gagal)
        throw new Error("Simulasi kegagalan pencatatan struk penjualan");
      });

      await expect(commitWithExternalFailure).rejects.toThrow(
        "Simulasi kegagalan pencatatan struk penjualan"
      );

      // Verifikasi seluruh efek commitReservation di-rollback secara utuh:
      const productAfterRollback = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      // Stok fisik tidak boleh berkurang
      expect(productAfterRollback.stock).toBe(20);
      // reservedStock tetap 5
      expect(productAfterRollback.reservedStock).toBe(5);

      // Status reservasi tetap ACTIVE (tidak menjadi COMMITTED)
      const reservation = await prisma.stockReservation.findFirstOrThrow({
        where: { orderId: order.id },
      });
      expect(reservation.status).toBe("ACTIVE");
      expect(reservation.remainingQty).toBe(5);

      // Tidak ada stock movement ORDER_FULFILLED yang tersimpan
      const movements = await prisma.stockMovement.findMany({
        where: { refId: order.id },
      });
      expect(movements).toHaveLength(0);
    });
  });
});
