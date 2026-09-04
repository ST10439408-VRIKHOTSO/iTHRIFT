'use strict';

/* ----------------------------- Admin console ----------------------------- */

async function renderAdmin(view, section = 'dashboard', query = {}) {
  if (!requireLogin('/admin')) return;
  if (state.user.type !== 'admin' && state.user.type !== 'staff') {
    view.innerHTML = `<div class="container section center"><h2>Staff access only</h2><p>Sign in with a staff or administrator account to reach the console.</p></div>`;
    return;
  }
  const isAdmin = state.user.type === 'admin';
  section = section || 'dashboard';

  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'listings', label: 'Listings' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'orders', label: 'Process orders' },
    ...(isAdmin ? [{ key: 'customers', label: 'Customers' }] : []),
  ];

  view.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        ${navItems.map(n => `<a href="#/admin/${n.key}" class="${section === n.key ? 'active' : ''}">${n.label}</a>`).join('')}
      </aside>
      <div class="admin-main" id="admin-main"></div>
    </div>
  `;

  const main = document.getElementById('admin-main');

  if (section === 'dashboard') await renderAdminDashboard(main);
  else if (section === 'listings') await renderAdminListings(main);
  else if (section === 'inventory') await renderAdminInventory(main);
  else if (section === 'orders') await renderAdminOrders(main, query);
  else if (section === 'customers' && isAdmin) await renderAdminCustomers(main);
  else main.innerHTML = `<h2>Not found</h2>`;
}

async function renderAdminDashboard(main) {
  const data = await api('/admin/reports/sales');
  main.innerHTML = `
    <h1>Dashboard</h1>
    <div class="stat-row">
      <div class="stat-card"><div class="num">${money(data.totals.revenue)}</div><div class="label">Total revenue</div></div>
      <div class="stat-card"><div class="num">${data.totals.orderCount}</div><div class="label">Orders placed</div></div>
      ${data.byStatus.map(s => `<div class="stat-card"><div class="num">${s.count}</div><div class="label">${s.status}</div></div>`).join('')}
    </div>
    <div class="two-col">
      <div class="panel">
        <h3>Revenue by brand</h3>
        <table><thead><tr><th>Brand</th><th>Units sold</th><th>Revenue</th></tr></thead>
        <tbody>${data.byBrand.map(b => `<tr><td>${escapeHtml(b.brand)}</td><td>${b.unitsSold}</td><td>${money(b.revenue)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">No sales yet.</td></tr>'}</tbody></table>
      </div>
      <div class="panel">
        <h3>Revenue by category</h3>
        <table><thead><tr><th>Category</th><th>Units sold</th><th>Revenue</th></tr></thead>
        <tbody>${data.byCategory.map(c => `<tr><td>${escapeHtml(c.category)}</td><td>${c.unitsSold}</td><td>${money(c.revenue)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">No sales yet.</td></tr>'}</tbody></table>
      </div>
    </div>
  `;
}

async function renderAdminListings(main) {
  const { products } = await api('/products');
  main.innerHTML = `
    <div class="flex-between"><h1>Listings</h1><button class="pill-btn accent" id="add-product-btn">+ Add product</button></div>
    <table>
      <thead><tr><th>Ref</th><th>Product</th><th>Brand</th><th>Size</th><th>Condition</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td>${p.ref}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.brand)}</td>
            <td>${escapeHtml(p.size)}</td>
            <td><span class="badge ${conditionClass(p.condition)}">${p.condition}</span></td>
            <td>${money(p.price)}</td>
            <td>${p.stock === 0 ? '<span class="badge out">0</span>' : p.stock}</td>
            <td>
              <button class="muted-link" style="background:none;border:none" data-edit="${p.id}">Edit</button>
              &middot;
              <button class="muted-link" style="background:none;border:none;color:var(--bad)" data-delete="${p.id}">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null, main));
  main.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const { product } = await api(`/products/${btn.dataset.edit}`);
    openProductModal(product, main);
  }));
  main.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Remove this listing?')) return;
    try {
      const result = await api(`/products/${btn.dataset.delete}`, { method: 'DELETE' });
      toast(result.note || 'Listing removed.', 'success');
      renderAdminListings(main);
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

function openProductModal(product, main) {
  const isEdit = Boolean(product);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="modal-close" type="button" aria-label="Close dialog">&times;</button>
      <h2>${isEdit ? 'Edit product' : 'Add product'}</h2>
      <form id="product-form">
        <div class="field"><label>Name</label><input type="text" name="name" required value="${isEdit ? escapeHtml(product.name) : ''}"></div>
        <div class="field"><label>Description</label><textarea name="description" required>${isEdit ? escapeHtml(product.description) : ''}</textarea></div>
        <div class="form-row">
          <div class="field"><label>Brand</label>
            <select name="brandId" required>${state.brands.map(b => `<option value="${b.id}" ${isEdit && product.brandId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Category</label>
            <select name="categoryId" required>${state.categories.map(c => `<option value="${c.id}" ${isEdit && product.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label>Size</label><input type="text" name="size" required value="${isEdit ? escapeHtml(product.size) : ''}"></div>
          <div class="field"><label>Condition</label>
            <select name="condition" required>${['Excellent', 'Very Good', 'Good', 'Fair'].map(c => `<option value="${c}" ${isEdit && product.condition === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label>Price (R)</label><input type="number" min="0" step="1" name="price" required value="${isEdit ? product.price : ''}"></div>
          <div class="field"><label>Stock quantity</label><input type="number" min="0" step="1" name="stock" required value="${isEdit ? product.stock : ''}"></div>
        </div>
        <button class="pill-btn accent full-btn" type="submit">${isEdit ? 'Save changes' : 'Add product'}</button>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('#modal-close').addEventListener('click', close);

  backdrop.querySelector('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      if (isEdit) {
        await api(`/products/${product.id}`, { method: 'PUT', body });
        toast('Product updated.', 'success');
      } else {
        await api('/products', { method: 'POST', body });
        toast('Product added.', 'success');
      }
      close();
      renderAdminListings(main);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function renderAdminInventory(main) {
  const data = await api('/admin/reports/inventory');
  main.innerHTML = `
    <h1>Inventory</h1>
    <div class="stat-row">
      <div class="stat-card"><div class="num">${data.outOfStock.length}</div><div class="label">Out of stock</div></div>
      <div class="stat-card"><div class="num">${data.lowStock.length}</div><div class="label">Low stock (&le; ${data.threshold})</div></div>
      <div class="stat-card"><div class="num">${data.all.length}</div><div class="label">Total listings</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <h3>Out of stock</h3>
        <table><thead><tr><th>Product</th><th>Brand</th><th>Category</th></tr></thead>
        <tbody>${data.outOfStock.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.brand)}</td><td>${escapeHtml(p.category)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">Nothing out of stock.</td></tr>'}</tbody></table>
      </div>
      <div class="panel">
        <h3>Low stock</h3>
        <table><thead><tr><th>Product</th><th>Stock</th><th>Brand</th></tr></thead>
        <tbody>${data.lowStock.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${escapeHtml(p.brand)}</td></tr>`).join('') || '<tr><td colspan="3" class="small">Stock levels look healthy.</td></tr>'}</tbody></table>
      </div>
    </div>
  `;
}

async function renderAdminOrders(main, query) {
  const params = new URLSearchParams(query.status ? { status: query.status } : {});
  const { orders } = await api('/orders?' + params.toString());
  const statuses = ['', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  main.innerHTML = `
    <div class="flex-between"><h1>Process orders</h1>
      <select id="status-filter">
        ${statuses.map(s => `<option value="${s}" ${query.status === s ? 'selected' : ''}>${s || 'All statuses'}</option>`).join('')}
      </select>
    </div>
    <table>
      <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th></th></tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><strong>${o.ref}</strong></td>
            <td>${escapeHtml(o.customer)}</td>
            <td>${timeAgo(o.createdAt)}</td>
            <td><span class="badge ${statusClass(o.status)}">${o.status}</span></td>
            <td>${money(o.total)}</td>
            <td><a class="muted-link" href="#/orders/${o.id}">Open</a></td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="small">No orders for this filter.</td></tr>'}
      </tbody>
    </table>
  `;

  document.getElementById('status-filter').addEventListener('change', (e) => {
    location.hash = buildHash('admin/orders', { status: e.target.value });
  });
}

async function renderAdminCustomers(main) {
  const { users } = await api('/admin/users');
  main.innerHTML = `
    <h1>Customers</h1>
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>City</th><th>Joined</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.city ? escapeHtml(u.city) : '&mdash;'}</td>
            <td>${timeAgo(u.createdAt)}</td>
            <td><span class="badge ${u.status === 'active' ? 'excellent' : 'out'}">${u.status}</span></td>
            <td><button class="muted-link" style="background:none;border:none" data-toggle="${u.id}" data-status="${u.status}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  main.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
    const newStatus = btn.dataset.status === 'active' ? 'suspended' : 'active';
    try {
      await api(`/admin/users/${btn.dataset.toggle}/status`, { method: 'PUT', body: { status: newStatus } });
      toast('Customer account updated.', 'success');
      renderAdminCustomers(main);
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}
