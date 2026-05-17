'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Lang = 'en' | 'pt' | 'es'

// ── English ───────────────────────────────────────────────────
const en = {
  lang: { en: 'English', pt: 'Português', es: 'Español' },
  nav: {
    dashboard: 'Dashboard', pricing: 'Pricing', materials: 'Materials',
    equipment: 'Equipment', products: 'Products', orders: 'Orders',
    clients: 'Clients', suppliers: 'Suppliers', expenses: 'Expenses',
    cashFlow: 'Cash Flow', wallet: 'Wallet', settings: 'Settings', billing: 'Billing', signOut: 'Sign out',
  },
  common: {
    save: 'Save changes', saving: 'Saving…', saved: 'Saved!',
    cancel: 'Cancel', add: 'Add', adding: 'Adding…', edit: 'Edit',
    delete: 'Delete', back: 'Back', finish: 'Finish', continue: 'Continue',
    loading: 'Loading…', optional: 'Optional', required: 'Required',
    search: 'Search…', noResults: 'No results found.',
    error: 'Something went wrong.', confirm: 'Confirm',
    new: 'New', close: 'Close', yes: 'Yes', no: 'No',
    total: 'Total', notes: 'Notes (optional)', date: 'Date',
    name: 'Name', email: 'Email', phone: 'Phone', address: 'Address',
    city: 'City', state: 'State', country: 'Country', document: 'CNPJ / EIN',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome to Filametry. What would you like to do today?',
    revenue: 'Revenue (this month)', expenses: 'Expenses (this month)',
    balance: 'Balance (this month)', registeredPrinters: 'Registered Printers',
    pricing: 'Pricing Calculator', pricingDesc: 'Calculate cost per gram, print time, energy, and margin.',
    materials: 'Materials', materialsDesc: 'Track your stock, cost per material, and consumption.',
    products: 'Products', productsDesc: 'Manage your catalog with photos, materials, and pricing.',
    orders: 'Orders', ordersDesc: 'Generate quotes and track order status for clients.',
  },
  materials: {
    title: 'Materials', subtitle: 'Track stock, costs, and consumption.',
    addItem: '+ Add item', noItems: 'No items yet. Add your first material.',
    items: 'Items', totalRemaining: 'Total remaining', inventoryValue: 'Inventory value',
    itemsInStock: (n: number) => `${n} item${n !== 1 ? 's' : ''} in stock`,
    category: 'Category', brand: 'Brand', itemName: 'Name / Color',
    material: 'Material', unit: 'Unit', totalQty: 'Total qty',
    remainingQty: 'Remaining', purchasePrice: 'Purchase price ($)',
    purchaseDate: 'Purchase date', costPerUnit: 'Cost/unit', valueLeft: 'Value left',
    remaining: 'Remaining', addSpool: 'Add item', editItem: 'Edit item',
    costPreview: 'Cost per unit',
    categories: {
      Filament: 'Filament', Tool: 'Tool', Packaging: 'Packaging',
      Accessory: 'Accessory', Other: 'Other',
    },
    units: { g: 'Grams (g)', kg: 'Kilograms (kg)', units: 'Units', m: 'Meters (m)', ml: 'ml' },
  },
  pricing: {
    title: 'Pricing Calculator', subtitle: 'Calculate costs and set your sale price.',
    filament: 'Filament', timeEnergy: 'Time & Energy', marginOverhead: 'Margin & Overhead',
    costBreakdown: 'Cost Breakdown',
    weightG: 'Print weight', spoolPrice: 'Spool price', spoolWeight: 'Spool weight',
    printTime: 'Print time', printerPower: 'Printer power', electricityCost: 'Electricity cost',
    equipAmort: 'Equipment amortization', failureRate: 'Failure / waste', marginPct: 'Profit margin',
    totalCost: 'Total cost', profit: 'Profit', suggestedPrice: 'Suggested sale price',
    importSlicer: 'Import from slicer', printer: 'Printer',
    amortFrom: 'Amortization auto-filled from:',
  },
  equipment: {
    title: 'Equipment', subtitle: 'Manage printers and track equipment investment.',
    addPrinter: 'Add printer', noPrinters: 'No printers registered yet.',
    fleetValue: 'Fleet value', printers: 'Printers', totalCostHour: 'Total cost/hour',
    purchaseValue: 'Purchase value', lifespan: 'Lifespan', costPerHour: 'Cost per hour',
    nickname: 'Nickname', brand: 'Brand', model: 'Model', power: 'Power (W)',
    purchaseDate: 'Purchase date', expectedLifespan: 'Expected lifespan (hours)',
    equipValue: 'Equipment value (for amortization)',
    partnershipShare: 'Partnership share', expected: 'expected', paid: 'paid',
    owes: 'owes', isOwed: 'owed', recordPayment: 'Record payment',
    addPayment: 'Add payment', payments: 'Payments', totalPaid: 'Total paid',
    payerName: 'Payer name', amount: 'Amount $',
    atLimit: 'Printer limit reached', upgradeToAdd: 'Upgrade your plan to register more printers.',
    upgradePlan: 'Upgrade plan',
  },
  products: {
    title: 'Products', subtitle: 'Manage your catalog with materials and pricing.',
    addProduct: 'Add product', noProducts: 'No products yet. Add your first item.',
    noProductsSearch: 'No products match your search.',
    catalogValue: 'Catalog value', avgMargin: 'Avg margin',
    description: 'Description', material: 'Material', weightG: 'Weight (g)',
    printHours: 'Print time (h)', costUSD: 'Production cost ($)', priceUSD: 'Sale price ($)',
    tags: 'Tags (comma separated)', imageUrl: 'Image URL (optional)',
    cost: 'COST', profit: 'PROFIT', price: 'PRICE', margin: 'Margin',
  },
  orders: {
    title: 'Orders', subtitle: 'Track quotes and orders from draft to delivery.',
    newOrder: '+ New order', noOrders: 'No orders here yet.',
    totalOrders: 'Total orders', revenueDone: 'Revenue (done)', inProgress: 'In progress',
    clientName: 'Client name', clientEmail: 'Client email (optional)',
    notes: 'Notes (optional)', items: 'Items', addItem: '+ Add item',
    productName: 'Product name', qty: 'Qty', unitPrice: 'Unit price ($)',
    moveTo: 'Move to', cancelOrder: 'Cancel order', createOrder: 'Create order',
    status: {
      all: 'All', draft: 'Draft', sent: 'Sent', accepted: 'Accepted',
      printing: 'Printing', done: 'Done', cancelled: 'Cancelled',
    },
  },
  clients: {
    title: 'Clients', subtitle: 'Manage your client database.',
    addClient: '+ Add client', noClients: 'No clients yet.',
    searchClients: 'Search clients…', editClient: 'Edit client',
  },
  suppliers: {
    title: 'Suppliers', subtitle: 'Manage your suppliers.',
    addSupplier: '+ Add supplier', noSuppliers: 'No suppliers yet.',
    searchSuppliers: 'Search suppliers…', editSupplier: 'Edit supplier',
    contactName: 'Contact name', website: 'Website',
  },
  expenses: {
    title: 'Expenses', subtitle: 'Track your business expenses.',
    addExpense: '+ Add expense', noExpenses: 'No expenses yet.',
    category: 'Category', amount: 'Amount ($)', paidAt: 'Paid at', supplier: 'Supplier (optional)',
    totalMonth: 'This month', totalYear: 'This year', largest: 'Largest expense',
  },
  cashFlow: {
    title: 'Cash Flow', subtitle: 'Track all income and expenses.',
    addEntry: '+ Add entry', noEntries: 'No entries yet.',
    income: 'Income', expense: 'Expense', balance: 'Balance',
    type: 'Type', category: 'Category', description: 'Description',
    amount: 'Amount ($)', reference: 'Reference',
  },
  settings: {
    title: 'Settings', subtitle: 'Manage your company information and partners.',
    companyInfo: 'Company Info', partners: 'Partners',
    companyName: 'Company name *', ownerName: 'Owner name *',
    businessEmail: 'Business email', isPartnership: 'This is a partnership business',
    addPartner: 'Add partner', partnerName: 'Full name *',
    partnerEmail: 'Email (optional)', partnerShare: '% share',
  },
  onboarding: {
    stepCompany: 'Company Info', stepPartnership: 'Partnership', stepDone: 'Done',
    setupTitle: 'Set up your company', setupSubtitle: 'Tell us about your 3D printing business.',
    partnerTitle: 'Is this a partnership?', partnerSubtitle: 'Do you run this business with partners?',
    solo: 'No, solo business', partnership: 'Yes, partnership',
    partners: 'Partners', addPartner: 'Add partner',
    doneTitle: "You're all set!", doneSubtitle: 'Your company is ready. Start managing your 3D printing business.',
    goDashboard: 'Go to Dashboard', continue: 'Continue', finish: 'Finish setup',
  },
  auth: {
    signIn: 'Sign in', signUp: 'Create account', signInGoogle: 'Continue with Google',
    email: 'Email', password: 'Password', name: 'Your name',
    noAccount: "Don't have an account?", hasAccount: 'Already have an account?',
    signInLink: 'Sign in', signUpLink: 'Create one',
    forgotPassword: 'Forgot password?',
  },
  billing: {
    title: 'Billing', subtitle: 'Manage your subscription.',
    currentPlan: 'Current plan', upgrade: 'Upgrade', manage: 'Manage subscription',
    trial: 'Trial', monthly: 'Monthly', yearly: 'Yearly',
  },
}

// ── Portuguese (BR) ───────────────────────────────────────────
const pt: typeof en = {
  lang: { en: 'English', pt: 'Português', es: 'Español' },
  nav: {
    dashboard: 'Painel', pricing: 'Precificação', materials: 'Materiais',
    equipment: 'Equipamentos', products: 'Produtos', orders: 'Pedidos',
    clients: 'Clientes', suppliers: 'Fornecedores', expenses: 'Despesas',
    cashFlow: 'Fluxo de Caixa', wallet: 'Carteira', settings: 'Configurações', billing: 'Plano', signOut: 'Sair',
  },
  common: {
    save: 'Salvar alterações', saving: 'Salvando…', saved: 'Salvo!',
    cancel: 'Cancelar', add: 'Adicionar', adding: 'Adicionando…', edit: 'Editar',
    delete: 'Excluir', back: 'Voltar', finish: 'Concluir', continue: 'Continuar',
    loading: 'Carregando…', optional: 'Opcional', required: 'Obrigatório',
    search: 'Buscar…', noResults: 'Nenhum resultado encontrado.',
    error: 'Algo deu errado.', confirm: 'Confirmar',
    new: 'Novo', close: 'Fechar', yes: 'Sim', no: 'Não',
    total: 'Total', notes: 'Observações (opcional)', date: 'Data',
    name: 'Nome', email: 'E-mail', phone: 'Telefone', address: 'Endereço',
    city: 'Cidade', state: 'Estado', country: 'País', document: 'CNPJ / CPF',
  },
  dashboard: {
    title: 'Painel',
    subtitle: 'Bem-vindo ao Filametry. O que deseja fazer hoje?',
    revenue: 'Receita (este mês)', expenses: 'Despesas (este mês)',
    balance: 'Saldo (este mês)', registeredPrinters: 'Impressoras Registradas',
    pricing: 'Calculadora de Preços', pricingDesc: 'Calcule custo por grama, tempo de impressão, energia e margem.',
    materials: 'Materiais', materialsDesc: 'Controle seu estoque, custo por material e consumo.',
    products: 'Produtos', productsDesc: 'Gerencie seu catálogo com fotos, materiais e preços.',
    orders: 'Pedidos', ordersDesc: 'Gere orçamentos e acompanhe o status dos pedidos dos clientes.',
  },
  materials: {
    title: 'Materiais', subtitle: 'Controle estoque, custos e consumo.',
    addItem: '+ Adicionar item', noItems: 'Nenhum item ainda. Adicione seu primeiro material.',
    items: 'Itens', totalRemaining: 'Total restante', inventoryValue: 'Valor em estoque',
    itemsInStock: (n: number) => `${n} item${n !== 1 ? 'ns' : ''} em estoque`,
    category: 'Categoria', brand: 'Marca', itemName: 'Nome / Cor',
    material: 'Material', unit: 'Unidade', totalQty: 'Qtd total',
    remainingQty: 'Restante', purchasePrice: 'Preço de compra (R$)',
    purchaseDate: 'Data de compra', costPerUnit: 'Custo/unidade', valueLeft: 'Valor restante',
    remaining: 'Restante', addSpool: 'Adicionar item', editItem: 'Editar item',
    costPreview: 'Custo por unidade',
    categories: {
      Filament: 'Filamento', Tool: 'Ferramenta', Packaging: 'Embalagem',
      Accessory: 'Acessório', Other: 'Outro',
    },
    units: { g: 'Gramas (g)', kg: 'Quilogramas (kg)', units: 'Unidades', m: 'Metros (m)', ml: 'ml' },
  },
  pricing: {
    title: 'Calculadora de Preços', subtitle: 'Calcule custos e defina seu preço de venda.',
    filament: 'Filamento', timeEnergy: 'Tempo & Energia', marginOverhead: 'Margem & Overhead',
    costBreakdown: 'Detalhamento de Custos',
    weightG: 'Peso da impressão', spoolPrice: 'Preço do carretel', spoolWeight: 'Peso do carretel',
    printTime: 'Tempo de impressão', printerPower: 'Potência da impressora', electricityCost: 'Custo de energia',
    equipAmort: 'Amortização do equipamento', failureRate: 'Falhas / desperdício', marginPct: 'Margem de lucro',
    totalCost: 'Custo total', profit: 'Lucro', suggestedPrice: 'Preço de venda sugerido',
    importSlicer: 'Importar do fatiador', printer: 'Impressora',
    amortFrom: 'Amortização preenchida automaticamente de:',
  },
  equipment: {
    title: 'Equipamentos', subtitle: 'Gerencie impressoras e controle o investimento.',
    addPrinter: 'Adicionar impressora', noPrinters: 'Nenhuma impressora registrada.',
    fleetValue: 'Valor do parque', printers: 'Impressoras', totalCostHour: 'Custo total/hora',
    purchaseValue: 'Valor de compra', lifespan: 'Vida útil', costPerHour: 'Custo por hora',
    nickname: 'Apelido', brand: 'Marca', model: 'Modelo', power: 'Potência (W)',
    purchaseDate: 'Data de compra', expectedLifespan: 'Vida útil esperada (horas)',
    equipValue: 'Valor do equipamento (para amortização)',
    partnershipShare: 'Participação dos sócios', expected: 'esperado', paid: 'pago',
    owes: 'deve', isOwed: 'tem a receber', recordPayment: 'Registrar pagamento',
    addPayment: 'Adicionar pagamento', payments: 'Pagamentos', totalPaid: 'Total pago',
    payerName: 'Nome do pagador', amount: 'Valor R$',
    atLimit: 'Limite de impressoras atingido', upgradeToAdd: 'Faça upgrade para registrar mais impressoras.',
    upgradePlan: 'Fazer upgrade',
  },
  products: {
    title: 'Produtos', subtitle: 'Gerencie seu catálogo com materiais e preços.',
    addProduct: 'Adicionar produto', noProducts: 'Nenhum produto ainda. Adicione seu primeiro item.',
    noProductsSearch: 'Nenhum produto encontrado para essa busca.',
    catalogValue: 'Valor do catálogo', avgMargin: 'Margem média',
    description: 'Descrição', material: 'Material', weightG: 'Peso (g)',
    printHours: 'Tempo de impressão (h)', costUSD: 'Custo de produção (R$)', priceUSD: 'Preço de venda (R$)',
    tags: 'Tags (separadas por vírgula)', imageUrl: 'URL da imagem (opcional)',
    cost: 'CUSTO', profit: 'LUCRO', price: 'PREÇO', margin: 'Margem',
  },
  orders: {
    title: 'Pedidos', subtitle: 'Acompanhe orçamentos e pedidos do rascunho à entrega.',
    newOrder: '+ Novo pedido', noOrders: 'Nenhum pedido ainda.',
    totalOrders: 'Total de pedidos', revenueDone: 'Receita (concluídos)', inProgress: 'Em andamento',
    clientName: 'Nome do cliente', clientEmail: 'E-mail do cliente (opcional)',
    notes: 'Observações (opcional)', items: 'Itens', addItem: '+ Adicionar item',
    productName: 'Nome do produto', qty: 'Qtd', unitPrice: 'Preço unitário (R$)',
    moveTo: 'Mover para', cancelOrder: 'Cancelar pedido', createOrder: 'Criar pedido',
    status: {
      all: 'Todos', draft: 'Rascunho', sent: 'Enviado', accepted: 'Aceito',
      printing: 'Imprimindo', done: 'Concluído', cancelled: 'Cancelado',
    },
  },
  clients: {
    title: 'Clientes', subtitle: 'Gerencie sua base de clientes.',
    addClient: '+ Adicionar cliente', noClients: 'Nenhum cliente ainda.',
    searchClients: 'Buscar clientes…', editClient: 'Editar cliente',
  },
  suppliers: {
    title: 'Fornecedores', subtitle: 'Gerencie seus fornecedores.',
    addSupplier: '+ Adicionar fornecedor', noSuppliers: 'Nenhum fornecedor ainda.',
    searchSuppliers: 'Buscar fornecedores…', editSupplier: 'Editar fornecedor',
    contactName: 'Nome do contato', website: 'Site',
  },
  expenses: {
    title: 'Despesas', subtitle: 'Controle as despesas do seu negócio.',
    addExpense: '+ Adicionar despesa', noExpenses: 'Nenhuma despesa ainda.',
    category: 'Categoria', amount: 'Valor (R$)', paidAt: 'Pago em', supplier: 'Fornecedor (opcional)',
    totalMonth: 'Este mês', totalYear: 'Este ano', largest: 'Maior despesa',
  },
  cashFlow: {
    title: 'Fluxo de Caixa', subtitle: 'Controle todas as entradas e saídas.',
    addEntry: '+ Adicionar lançamento', noEntries: 'Nenhum lançamento ainda.',
    income: 'Entrada', expense: 'Saída', balance: 'Saldo',
    type: 'Tipo', category: 'Categoria', description: 'Descrição',
    amount: 'Valor (R$)', reference: 'Referência',
  },
  settings: {
    title: 'Configurações', subtitle: 'Gerencie as informações da empresa e sócios.',
    companyInfo: 'Informações da Empresa', partners: 'Sócios',
    companyName: 'Nome da empresa *', ownerName: 'Nome do proprietário *',
    businessEmail: 'E-mail comercial', isPartnership: 'Esta é uma empresa com sócios',
    addPartner: 'Adicionar sócio', partnerName: 'Nome completo *',
    partnerEmail: 'E-mail (opcional)', partnerShare: '% participação',
  },
  onboarding: {
    stepCompany: 'Empresa', stepPartnership: 'Sociedade', stepDone: 'Pronto',
    setupTitle: 'Configure sua empresa', setupSubtitle: 'Conte-nos sobre seu negócio de impressão 3D.',
    partnerTitle: 'É uma sociedade?', partnerSubtitle: 'Você gerencia este negócio com sócios?',
    solo: 'Não, negócio solo', partnership: 'Sim, é uma sociedade',
    partners: 'Sócios', addPartner: 'Adicionar sócio',
    doneTitle: 'Tudo pronto!', doneSubtitle: 'Sua empresa está configurada. Comece a gerenciar seu negócio.',
    goDashboard: 'Ir para o Painel', continue: 'Continuar', finish: 'Finalizar configuração',
  },
  auth: {
    signIn: 'Entrar', signUp: 'Criar conta', signInGoogle: 'Continuar com Google',
    email: 'E-mail', password: 'Senha', name: 'Seu nome',
    noAccount: 'Não tem uma conta?', hasAccount: 'Já tem uma conta?',
    signInLink: 'Entrar', signUpLink: 'Criar uma',
    forgotPassword: 'Esqueceu a senha?',
  },
  billing: {
    title: 'Plano', subtitle: 'Gerencie sua assinatura.',
    currentPlan: 'Plano atual', upgrade: 'Fazer upgrade', manage: 'Gerenciar assinatura',
    trial: 'Teste', monthly: 'Mensal', yearly: 'Anual',
  },
}

// ── Spanish ───────────────────────────────────────────────────
const es: typeof en = {
  lang: { en: 'English', pt: 'Português', es: 'Español' },
  nav: {
    dashboard: 'Panel', pricing: 'Precios', materials: 'Materiales',
    equipment: 'Equipos', products: 'Productos', orders: 'Pedidos',
    clients: 'Clientes', suppliers: 'Proveedores', expenses: 'Gastos',
    cashFlow: 'Flujo de Caja', wallet: 'Billetera', settings: 'Configuración', billing: 'Plan', signOut: 'Cerrar sesión',
  },
  common: {
    save: 'Guardar cambios', saving: 'Guardando…', saved: '¡Guardado!',
    cancel: 'Cancelar', add: 'Agregar', adding: 'Agregando…', edit: 'Editar',
    delete: 'Eliminar', back: 'Volver', finish: 'Finalizar', continue: 'Continuar',
    loading: 'Cargando…', optional: 'Opcional', required: 'Requerido',
    search: 'Buscar…', noResults: 'No se encontraron resultados.',
    error: 'Algo salió mal.', confirm: 'Confirmar',
    new: 'Nuevo', close: 'Cerrar', yes: 'Sí', no: 'No',
    total: 'Total', notes: 'Notas (opcional)', date: 'Fecha',
    name: 'Nombre', email: 'Correo', phone: 'Teléfono', address: 'Dirección',
    city: 'Ciudad', state: 'Estado', country: 'País', document: 'RUT / NIT / RFC',
  },
  dashboard: {
    title: 'Panel',
    subtitle: 'Bienvenido a Filametry. ¿Qué deseas hacer hoy?',
    revenue: 'Ingresos (este mes)', expenses: 'Gastos (este mes)',
    balance: 'Saldo (este mes)', registeredPrinters: 'Impresoras Registradas',
    pricing: 'Calculadora de Precios', pricingDesc: 'Calcula costo por gramo, tiempo de impresión, energía y margen.',
    materials: 'Materiales', materialsDesc: 'Controla tu stock, costo por material y consumo.',
    products: 'Productos', productsDesc: 'Gestiona tu catálogo con fotos, materiales y precios.',
    orders: 'Pedidos', ordersDesc: 'Genera presupuestos y sigue el estado de los pedidos.',
  },
  materials: {
    title: 'Materiales', subtitle: 'Controla stock, costos y consumo.',
    addItem: '+ Agregar item', noItems: 'Sin items aún. Agrega tu primer material.',
    items: 'Items', totalRemaining: 'Total restante', inventoryValue: 'Valor en stock',
    itemsInStock: (n: number) => `${n} item${n !== 1 ? 's' : ''} en stock`,
    category: 'Categoría', brand: 'Marca', itemName: 'Nombre / Color',
    material: 'Material', unit: 'Unidad', totalQty: 'Cant. total',
    remainingQty: 'Restante', purchasePrice: 'Precio de compra ($)',
    purchaseDate: 'Fecha de compra', costPerUnit: 'Costo/unidad', valueLeft: 'Valor restante',
    remaining: 'Restante', addSpool: 'Agregar item', editItem: 'Editar item',
    costPreview: 'Costo por unidad',
    categories: {
      Filament: 'Filamento', Tool: 'Herramienta', Packaging: 'Embalaje',
      Accessory: 'Accesorio', Other: 'Otro',
    },
    units: { g: 'Gramos (g)', kg: 'Kilogramos (kg)', units: 'Unidades', m: 'Metros (m)', ml: 'ml' },
  },
  pricing: {
    title: 'Calculadora de Precios', subtitle: 'Calcula costos y define tu precio de venta.',
    filament: 'Filamento', timeEnergy: 'Tiempo & Energía', marginOverhead: 'Margen & Overhead',
    costBreakdown: 'Desglose de Costos',
    weightG: 'Peso de impresión', spoolPrice: 'Precio del carrete', spoolWeight: 'Peso del carrete',
    printTime: 'Tiempo de impresión', printerPower: 'Potencia de impresora', electricityCost: 'Costo de energía',
    equipAmort: 'Amortización del equipo', failureRate: 'Fallos / desperdicio', marginPct: 'Margen de ganancia',
    totalCost: 'Costo total', profit: 'Ganancia', suggestedPrice: 'Precio de venta sugerido',
    importSlicer: 'Importar del slicer', printer: 'Impresora',
    amortFrom: 'Amortización llenada automáticamente de:',
  },
  equipment: {
    title: 'Equipos', subtitle: 'Gestiona impresoras y controla la inversión.',
    addPrinter: 'Agregar impresora', noPrinters: 'Sin impresoras registradas.',
    fleetValue: 'Valor del parque', printers: 'Impresoras', totalCostHour: 'Costo total/hora',
    purchaseValue: 'Valor de compra', lifespan: 'Vida útil', costPerHour: 'Costo por hora',
    nickname: 'Apodo', brand: 'Marca', model: 'Modelo', power: 'Potencia (W)',
    purchaseDate: 'Fecha de compra', expectedLifespan: 'Vida útil esperada (horas)',
    equipValue: 'Valor del equipo (para amortización)',
    partnershipShare: 'Participación de socios', expected: 'esperado', paid: 'pagado',
    owes: 'debe', isOwed: 'le deben', recordPayment: 'Registrar pago',
    addPayment: 'Agregar pago', payments: 'Pagos', totalPaid: 'Total pagado',
    payerName: 'Nombre del pagador', amount: 'Monto $',
    atLimit: 'Límite de impresoras alcanzado', upgradeToAdd: 'Actualiza tu plan para registrar más impresoras.',
    upgradePlan: 'Actualizar plan',
  },
  products: {
    title: 'Productos', subtitle: 'Gestiona tu catálogo con materiales y precios.',
    addProduct: 'Agregar producto', noProducts: 'Sin productos aún. Agrega tu primer item.',
    noProductsSearch: 'Ningún producto coincide con tu búsqueda.',
    catalogValue: 'Valor del catálogo', avgMargin: 'Margen promedio',
    description: 'Descripción', material: 'Material', weightG: 'Peso (g)',
    printHours: 'Tiempo de impresión (h)', costUSD: 'Costo de producción ($)', priceUSD: 'Precio de venta ($)',
    tags: 'Etiquetas (separadas por coma)', imageUrl: 'URL de imagen (opcional)',
    cost: 'COSTO', profit: 'GANANCIA', price: 'PRECIO', margin: 'Margen',
  },
  orders: {
    title: 'Pedidos', subtitle: 'Sigue presupuestos y pedidos desde borrador hasta entrega.',
    newOrder: '+ Nuevo pedido', noOrders: 'Sin pedidos aún.',
    totalOrders: 'Total de pedidos', revenueDone: 'Ingresos (completados)', inProgress: 'En progreso',
    clientName: 'Nombre del cliente', clientEmail: 'Correo del cliente (opcional)',
    notes: 'Notas (opcional)', items: 'Items', addItem: '+ Agregar item',
    productName: 'Nombre del producto', qty: 'Cant.', unitPrice: 'Precio unitario ($)',
    moveTo: 'Mover a', cancelOrder: 'Cancelar pedido', createOrder: 'Crear pedido',
    status: {
      all: 'Todos', draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado',
      printing: 'Imprimiendo', done: 'Completado', cancelled: 'Cancelado',
    },
  },
  clients: {
    title: 'Clientes', subtitle: 'Gestiona tu base de clientes.',
    addClient: '+ Agregar cliente', noClients: 'Sin clientes aún.',
    searchClients: 'Buscar clientes…', editClient: 'Editar cliente',
  },
  suppliers: {
    title: 'Proveedores', subtitle: 'Gestiona tus proveedores.',
    addSupplier: '+ Agregar proveedor', noSuppliers: 'Sin proveedores aún.',
    searchSuppliers: 'Buscar proveedores…', editSupplier: 'Editar proveedor',
    contactName: 'Nombre del contacto', website: 'Sitio web',
  },
  expenses: {
    title: 'Gastos', subtitle: 'Controla los gastos de tu negocio.',
    addExpense: '+ Agregar gasto', noExpenses: 'Sin gastos aún.',
    category: 'Categoría', amount: 'Monto ($)', paidAt: 'Pagado el', supplier: 'Proveedor (opcional)',
    totalMonth: 'Este mes', totalYear: 'Este año', largest: 'Mayor gasto',
  },
  cashFlow: {
    title: 'Flujo de Caja', subtitle: 'Controla todos los ingresos y gastos.',
    addEntry: '+ Agregar registro', noEntries: 'Sin registros aún.',
    income: 'Ingreso', expense: 'Gasto', balance: 'Saldo',
    type: 'Tipo', category: 'Categoría', description: 'Descripción',
    amount: 'Monto ($)', reference: 'Referencia',
  },
  settings: {
    title: 'Configuración', subtitle: 'Gestiona la información de la empresa y socios.',
    companyInfo: 'Información de la Empresa', partners: 'Socios',
    companyName: 'Nombre de la empresa *', ownerName: 'Nombre del propietario *',
    businessEmail: 'Correo empresarial', isPartnership: 'Esta es una empresa con socios',
    addPartner: 'Agregar socio', partnerName: 'Nombre completo *',
    partnerEmail: 'Correo (opcional)', partnerShare: '% participación',
  },
  onboarding: {
    stepCompany: 'Empresa', stepPartnership: 'Sociedad', stepDone: 'Listo',
    setupTitle: 'Configura tu empresa', setupSubtitle: 'Cuéntanos sobre tu negocio de impresión 3D.',
    partnerTitle: '¿Es una sociedad?', partnerSubtitle: '¿Gestionas este negocio con socios?',
    solo: 'No, negocio individual', partnership: 'Sí, es una sociedad',
    partners: 'Socios', addPartner: 'Agregar socio',
    doneTitle: '¡Todo listo!', doneSubtitle: 'Tu empresa está configurada. Empieza a gestionar tu negocio.',
    goDashboard: 'Ir al Panel', continue: 'Continuar', finish: 'Finalizar configuración',
  },
  auth: {
    signIn: 'Iniciar sesión', signUp: 'Crear cuenta', signInGoogle: 'Continuar con Google',
    email: 'Correo', password: 'Contraseña', name: 'Tu nombre',
    noAccount: '¿No tienes una cuenta?', hasAccount: '¿Ya tienes una cuenta?',
    signInLink: 'Iniciar sesión', signUpLink: 'Crear una',
    forgotPassword: '¿Olvidaste tu contraseña?',
  },
  billing: {
    title: 'Plan', subtitle: 'Gestiona tu suscripción.',
    currentPlan: 'Plan actual', upgrade: 'Actualizar', manage: 'Gestionar suscripción',
    trial: 'Prueba', monthly: 'Mensual', yearly: 'Anual',
  },
}

export type Dict = typeof en
export const dicts: Record<Lang, Dict> = { en, pt, es }

// ── Context ───────────────────────────────────────────────────
const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: 'en', setLang: () => {}, t: en,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('filametry_lang') as Lang | null
    if (stored && dicts[stored]) setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('filametry_lang', l)
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t: dicts[lang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  return useContext(I18nContext)
}
