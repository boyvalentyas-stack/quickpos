import { createContext, useContext, useState } from 'react'

const translations = {
  en: {
    // General
    loading: 'Loading...', back: '← Back', save: 'Save', cancel: 'Cancel',
    remove: 'Remove', edit: 'Edit', active: 'Active', signOut: 'Sign Out',
    openPOS: 'Open POS', today: 'Today',
    // Nav
    dashboard: 'Dashboard', pos: 'POS Terminal', products: 'Products',
    orders: 'Order History', staff: 'Staff', settings: 'Settings',
    // Auth
    welcomeBack: 'Welcome back', signingIn: 'Signing in...', signIn: 'Sign In',
    noAccount: 'No account yet?', createStore: 'Create your store',
    freeForever: 'Free forever. No credit card needed.',
    storeName: 'Store Name', yourName: 'Your Full Name',
    emailAddress: 'Email Address', password: 'Password',
    minPassword: 'Minimum 6 characters', creatingStore: 'Creating your store...',
    createStoreBtn: '🚀 Create Store & Sign Up', alreadyHaveAccount: 'Already have an account?',
    // Dashboard
    thisMonth: "This Month's Overview", revenue: 'Revenue',
    ordersCount: 'Orders', avgOrder: 'Avg. Order',
    recentOrders: 'Recent Orders', noOrders: 'No orders in',
    lowStockAlerts: '⚠️ Low Stock Alerts', allStocked: 'All products well stocked.',
    // POS
    searchPlaceholder: '🔍 Search products or scan barcode...',
    cart: 'Cart', clearCart: 'Clear', cashReceived: 'Cash Received (Rp)',
    change: 'Change', completeTransaction: '✓ Complete Transaction',
    processing: 'Processing...', limitReached: '⛔ Limit Reached',
    noProducts: 'No products found', addToCartHint: 'Tap a product to add it',
    outOfStock: 'Out of Stock', lowStock: 'Only', left: 'left', available: 'in stock',
    transactionsToday: 'Transactions today:', dailyLimitBanner: '⛔ Daily limit reached (100/day on Free plan). Resets at midnight.',
    approachingLimit: '⚠️ Approaching daily limit —', remaining: 'transactions remaining today.',
    close: 'Close', print: '🖨️ Print',
    paymentMethod: 'Payment Method', cash: 'Cash', qris: 'QRIS', total: 'Total',
    // Products
    addProduct: '+ Add Product', newProduct: 'New Product', productName: 'Product Name',
    emojiIcon: 'Emoji Icon', skuBarcode: 'SKU / Barcode', price: 'Price (Rp)',
    stock: 'Stock', category: 'Category', noCategory: 'No category',
    productImage: 'Product Image', imageHint: '(auto-resized to 400×400px, max 1MB)',
    clickToUpload: 'Click to upload', changeImage: 'Change Image', selectImage: 'Select Image',
    saving: 'Saving...', editProduct: 'Edit Product', saveChanges: 'Save Changes',
    outOfStockLabel: 'Out of Stock', units: 'units',
    freeLimitWarning: "Free plan limit reached. You've used all 30 product slots.",
    contactUpgrade: 'Contact the system owner to upgrade to Pro for unlimited products.',
    // Staff
    staffManagement: 'Staff Management', cashiers: 'cashiers', addCashier: '+ Add Cashier',
    addCashierTitle: 'Add Cashier / Admin',
    addCashierDesc: "They'll receive an email and can log in immediately. They can only access Dashboard and POS.",
    fullName: 'Full Name', loginPassword: 'Login Password',
    passwordHint: 'Share this password with your cashier. They cannot change it themselves.',
    adding: 'Adding...', yourTeam: 'Your Team', you: 'you', inactive: 'inactive',
    reactivate: 'Reactivate', cashierLimitReached: 'Cashier limit reached.',
    freePlanCashiers: 'Free plan allows up to 2 cashier accounts.',
    contactOwner: 'Contact system owner to upgrade to Pro for unlimited staff.',
    cashierPerms: 'ℹ️ Cashier access permissions',
    canDashboard: '✅ Can view Dashboard', canPOS: '✅ Can operate POS Terminal',
    cannotProducts: '❌ Cannot edit Products or Stock',
    cannotSettings: '❌ Cannot change Store Settings',
    cannotPassword: '❌ Cannot change their own password',
    ownerOnly: 'Owner access only', addedSuccess: 'has been added and will receive a login email.',
    // Settings
    storeDetails: '🏪 Store Details', storeDetailsDesc: 'This information appears on every printed receipt.',
    address: 'Address', phone: 'Phone Number', instagram: 'Instagram',
    receiptFooter: 'Receipt Footer', saveStoreDetails: 'Save Store Details',
    changePassword: '🔒 Change Password',
    changePasswordDesc: 'Change your owner account password. Cashier passwords can only be reset by you from the Staff page.',
    currentPassword: 'Current Password', newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password', changingPassword: 'Changing...',
    changePasswordBtn: 'Change Password', storeCode: 'Store Code',
    storeCodeDesc: 'Unique identifier for your store. Contact support to change.',
    // Orders
    orderNumber: 'Order #', dateTime: 'Date & Time', items: 'Items',
    payment: 'Payment', status: 'Status', noOrdersYet: 'No orders yet.',
  },
  id: {
    // General
    loading: 'Memuat...', back: '← Kembali', save: 'Simpan', cancel: 'Batal',
    remove: 'Hapus', edit: 'Edit', active: 'Aktif', signOut: 'Keluar',
    openPOS: 'Buka Kasir', today: 'Hari Ini',
    // Nav
    dashboard: 'Beranda', pos: 'Kasir', products: 'Produk',
    orders: 'Riwayat Pesanan', staff: 'Staf', settings: 'Pengaturan',
    // Auth
    welcomeBack: 'Selamat datang kembali', signingIn: 'Masuk...', signIn: 'Masuk',
    noAccount: 'Belum punya akun?', createStore: 'Buat toko Anda',
    freeForever: 'Gratis selamanya. Tanpa kartu kredit.',
    storeName: 'Nama Toko', yourName: 'Nama Lengkap Anda',
    emailAddress: 'Alamat Email', password: 'Kata Sandi',
    minPassword: 'Minimal 6 karakter', creatingStore: 'Membuat toko Anda...',
    createStoreBtn: '🚀 Buat Toko & Daftar', alreadyHaveAccount: 'Sudah punya akun?',
    // Dashboard
    thisMonth: 'Ringkasan Bulan Ini', revenue: 'Pendapatan',
    ordersCount: 'Pesanan', avgOrder: 'Rata-rata Pesanan',
    recentOrders: 'Pesanan Terbaru', noOrders: 'Tidak ada pesanan di',
    lowStockAlerts: '⚠️ Stok Hampir Habis', allStocked: 'Semua produk stok cukup.',
    // POS
    searchPlaceholder: '🔍 Cari produk atau scan barcode...',
    cart: 'Keranjang', clearCart: 'Kosongkan', cashReceived: 'Uang Diterima (Rp)',
    change: 'Kembalian', completeTransaction: '✓ Selesaikan Transaksi',
    processing: 'Memproses...', limitReached: '⛔ Batas Tercapai',
    noProducts: 'Produk tidak ditemukan', addToCartHint: 'Ketuk produk untuk menambahkan',
    outOfStock: 'Habis', lowStock: 'Sisa', left: '', available: 'tersedia',
    transactionsToday: 'Transaksi hari ini:', dailyLimitBanner: '⛔ Batas harian tercapai (100/hari paket Gratis). Direset tengah malam.',
    approachingLimit: '⚠️ Mendekati batas harian —', remaining: 'transaksi tersisa hari ini.',
    close: 'Tutup', print: '🖨️ Cetak',
    paymentMethod: 'Metode Pembayaran', cash: 'Tunai', qris: 'QRIS', total: 'Total',
    // Products
    addProduct: '+ Tambah Produk', newProduct: 'Produk Baru', productName: 'Nama Produk',
    emojiIcon: 'Ikon Emoji', skuBarcode: 'SKU / Barcode', price: 'Harga (Rp)',
    stock: 'Stok', category: 'Kategori', noCategory: 'Tanpa kategori',
    productImage: 'Foto Produk', imageHint: '(otomatis 400×400px, maks 1MB)',
    clickToUpload: 'Klik untuk upload', changeImage: 'Ganti Foto', selectImage: 'Pilih Foto',
    saving: 'Menyimpan...', editProduct: 'Edit Produk', saveChanges: 'Simpan Perubahan',
    outOfStockLabel: 'Habis', units: 'unit',
    freeLimitWarning: 'Batas paket gratis tercapai. Anda telah menggunakan 30 slot produk.',
    contactUpgrade: 'Hubungi pemilik sistem untuk upgrade ke Pro untuk produk tak terbatas.',
    // Staff
    staffManagement: 'Manajemen Staf', cashiers: 'kasir', addCashier: '+ Tambah Kasir',
    addCashierTitle: 'Tambah Kasir / Admin',
    addCashierDesc: 'Mereka akan mendapat email dan bisa langsung login. Hanya bisa akses Beranda dan Kasir.',
    fullName: 'Nama Lengkap', loginPassword: 'Kata Sandi Login',
    passwordHint: 'Bagikan kata sandi ini ke kasir Anda. Mereka tidak bisa mengubahnya sendiri.',
    adding: 'Menambahkan...', yourTeam: 'Tim Anda', you: 'Anda', inactive: 'nonaktif',
    reactivate: 'Aktifkan Kembali', cashierLimitReached: 'Batas kasir tercapai.',
    freePlanCashiers: 'Paket gratis hanya untuk 2 akun kasir.',
    contactOwner: 'Hubungi pemilik sistem untuk upgrade ke Pro.',
    cashierPerms: 'ℹ️ Hak akses kasir',
    canDashboard: '✅ Bisa lihat Beranda', canPOS: '✅ Bisa operasikan Kasir',
    cannotProducts: '❌ Tidak bisa edit Produk atau Stok',
    cannotSettings: '❌ Tidak bisa ubah Pengaturan Toko',
    cannotPassword: '❌ Tidak bisa ubah kata sandi sendiri',
    ownerOnly: 'Hanya untuk pemilik', addedSuccess: 'telah ditambahkan dan akan mendapat email notifikasi.',
    // Settings
    storeDetails: '🏪 Detail Toko', storeDetailsDesc: 'Informasi ini muncul di setiap struk yang dicetak.',
    address: 'Alamat', phone: 'Nomor Telepon', instagram: 'Instagram',
    receiptFooter: 'Footer Struk', saveStoreDetails: 'Simpan Detail Toko',
    changePassword: '🔒 Ganti Kata Sandi',
    changePasswordDesc: 'Ganti kata sandi akun pemilik. Kata sandi kasir hanya bisa direset oleh Anda dari halaman Staf.',
    currentPassword: 'Kata Sandi Saat Ini', newPassword: 'Kata Sandi Baru',
    confirmNewPassword: 'Konfirmasi Kata Sandi Baru', changingPassword: 'Mengubah...',
    changePasswordBtn: 'Ganti Kata Sandi', storeCode: 'Kode Toko',
    storeCodeDesc: 'Pengenal unik toko Anda. Hubungi support untuk mengubah.',
    // Orders
    orderNumber: 'No. Pesanan', dateTime: 'Tanggal & Waktu', items: 'Item',
    payment: 'Pembayaran', status: 'Status', noOrdersYet: 'Belum ada pesanan.',
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('qpos_lang') || 'id')
  const toggleLang = () => setLang(prev => {
    const next = prev === 'en' ? 'id' : 'en'
    localStorage.setItem('qpos_lang', next)
    return next
  })
  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() { return useContext(LanguageContext) }
