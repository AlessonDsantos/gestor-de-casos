// =============================================
// STORAGE & DADOS
// =============================================

const STORAGE_KEY = "caseTracker";

let cases = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// Migração: garante que registros antigos tenham campos novos
cases = cases.map(c => {
    if (!c.status) c.status = "";
    // Remove status "Follow Up" se existir em dados antigos
    if (c.status === "Follow Up") c.status = "";
    return c;
});
saveStorage();

let editingCaseId = null;

let currentSort = {
    field: null,
    direction: "asc"
};

// =============================================
// MAPA DE SUBSTATUS (sem Follow Up)
// =============================================

const subStatusMap = {
    "Need Info": [
        "Awaiting Validation",
        "Awaiting Inputs",
        "Attempted Contact",
        "In Consult",
        "Reschedule"
    ],
    "Implemented": [
        "Education Only",
        "Implemented Only",
        "Troubleshooting Only"
    ],
    "Inactive": [
        "Not Interested",
        "Not Reachable",
        "Not Ready",
        "Out Of Scope"
    ],
    "Discarded": [],
    "Open": []
};

// =============================================
// ELEMENTOS DO FORMULÁRIO
// =============================================

const statusSelect      = document.getElementById("status");
const subStatusSelect   = document.getElementById("subStatus");
const followUpSection   = document.getElementById("followUpSection");
const followUpDateInput = document.getElementById("followUpDate");
const followUpNACheckbox = document.getElementById("followUpNA");

// Mostrar/ocultar seção de Follow Up baseado no status
statusSelect.addEventListener("change", () => {
    const status = statusSelect.value;

    // Atualizar substatus
    subStatusSelect.innerHTML = '<option value="">Selecione</option>';
    if (subStatusMap[status]) {
        subStatusMap[status].forEach(sub => {
            const option = document.createElement("option");
            option.value = sub;
            option.textContent = sub;
            subStatusSelect.appendChild(option);
        });
    }

    // Mostrar Follow Up para "Need Info", "Inactive" e "Implemented"
    const statusesComFollowUp = ["Need Info", "Inactive", "Implemented"];
    if (statusesComFollowUp.includes(status)) {
        followUpSection.style.display = "block";
    } else {
        followUpSection.style.display = "none";
        // Limpar follow up quando muda para outro status
        followUpDateInput.value = "";
        followUpNACheckbox.checked = false;
    }
});

// Sincronizar data e checkbox N/A
followUpDateInput.addEventListener("change", () => {
    if (followUpDateInput.value) {
        followUpNACheckbox.checked = false;
    }
});

followUpNACheckbox.addEventListener("change", () => {
    if (followUpNACheckbox.checked) {
        followUpDateInput.value = "";
    }
});

// =============================================
// PERSISTÊNCIA
// =============================================

function saveStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

// =============================================
// ADICIONAR CASO
// =============================================

function addCase() {
    const caseNumber = document.getElementById("caseNumber").value.trim();
    if (!caseNumber) {
        alert("Informe o número do caso");
        return;
    }

    const status = document.getElementById("status").value;

    // Validar Follow Up para Need Info, Inactive e Implemented
    let followUpDate = "";
    let followUpNA = false;
    const statusesComFollowUp = ["Need Info", "Inactive", "Implemented"];
    
    if (statusesComFollowUp.includes(status)) {
        followUpDate = document.getElementById("followUpDate").value;
        followUpNA = document.getElementById("followUpNA").checked;
        if (!followUpDate && !followUpNA) {
            alert(`Para ${status}, informe uma data de Follow Up ou marque N/A`);
            return;
        }
    }

    cases.push({
        id:           Date.now(),
        caseNumber,
        status,
        subStatus:    document.getElementById("subStatus").value,
        notes:        document.getElementById("notes").value,
        followUpDate: followUpDate,
        followUpNA:   followUpNA,
        noteAdded:    document.getElementById("noteAdded").checked,
        emailSent:    document.getElementById("emailSent").checked,
        qplusDone:    document.getElementById("qplusDone").checked,
        createdAt:    new Date().toLocaleString(),
        updatedAt:    new Date().toLocaleString()
    });

    saveStorage();
    renderCases();
    updateDashboard();
    updateFollowUpAlerts();
    clearForm();
}

// =============================================
// EXCLUIR CASO
// =============================================

function deleteCase(id) {
    if (!confirm("Excluir caso?")) return;
    cases = cases.filter(c => c.id !== id);
    saveStorage();
    renderCases();
    updateDashboard();
    updateFollowUpAlerts();
}

// =============================================
// HELPER: classe CSS por status
// =============================================

function getStatusClass(status) {
    switch ((status || "").toLowerCase().replace(/\s/g, "")) {
        case "implemented": return "status-implemented";
        case "inactive":    return "status-inactive";
        case "needinfo":    return "status-needinfo";
        case "discarded":   return "status-discarded";
        default:            return "";
    }
}

// =============================================
// HELPER: obter data de criação como string ISO
// para comparação com filtros de data
// =============================================

function sortCases(field) {

    if (currentSort.field === field) {

        currentSort.direction =
            currentSort.direction === "asc"
                ? "desc"
                : "asc";

    } else {

        currentSort.field = field;
        currentSort.direction = "asc";

    }

    renderCases();
}

function getCreatedDateISO(c) {

    if (!c.createdAt) return "";

    // Extrai a data brasileira: dd/mm/yyyy
    const parts = c.createdAt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if (parts) {

        const day = parts[1].padStart(2, "0");
        const month = parts[2].padStart(2, "0");
        const year = parts[3];

        return `${year}-${month}-${day}`;
    }

    return "";
}

// =============================================
// RENDERIZAR TABELA (com todos os filtros)
// =============================================

function renderCases() {
    const table        = document.getElementById("caseTable");
    const search       = (document.getElementById("search").value || "").toLowerCase();
    const filterStatus = (document.getElementById("filterStatus").value || "");
    const filterFrom   = (document.getElementById("filterDateFrom").value || "");
    const filterTo     = (document.getElementById("filterDateTo").value || "");

    table.innerHTML = "";

    const today = new Date().toISOString().split("T")[0];

    const getPriority = (item) => {
        // Casos com Follow Up N/A não têm prioridade
        if (item.followUpNA) return 999;

        if (item.followUpDate && item.followUpDate < today) return 1; // vencido
        if (item.followUpDate === today) return 2;                    // hoje
        return 3;
    };

    let filteredCases = cases
        .slice()
        .filter(c => {

            // Filtro: busca por número
            if (search && !c.caseNumber.toLowerCase().includes(search)) return false;

            // Filtro: status
            if (filterStatus && c.status !== filterStatus) return false;

            // Filtro: data inicial e final (usa createdAt)
            const dateISO = getCreatedDateISO(c);

            if (filterFrom && dateISO && dateISO < filterFrom) return false;
            if (filterTo   && dateISO && dateISO > filterTo)   return false;

            return true;
        });

    // ==========================
    // ORDENAÇÃO
    // ==========================
    if (currentSort.field) {

        filteredCases.sort((a, b) => {

            let valueA = a[currentSort.field] || "";
            let valueB = b[currentSort.field] || "";

            if (valueA < valueB) {
                return currentSort.direction === "asc" ? -1 : 1;
            }

            if (valueA > valueB) {
                return currentSort.direction === "asc" ? 1 : -1;
            }

            return 0;
        });

    } else {

        // comportamento atual:
        // Follow Ups vencidos primeiro
        filteredCases.sort(
            (a, b) => getPriority(a) - getPriority(b)
        );

    }

    filteredCases.forEach(c => {

        const statusClass = getStatusClass(c.status);

        // Exibir Follow Up na tabela
        let followUpDisplay = "-";

        if (c.followUpNA) {
            followUpDisplay = "N/A";
        } else if (c.followUpDate) {
            followUpDisplay = formatDateBR(c.followUpDate);
        }

        // Verificar se é Follow Up para hoje
           let rowClass = '';

     if (!c.followUpNA && c.followUpDate) {

    if (c.followUpDate < today) {

        rowClass = 'follow-up-overdue';

    } else if (c.followUpDate === today) {

        rowClass = 'follow-up-today';

    } else {

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tomorrowStr =
            tomorrow.toISOString().split('T')[0];

        if (c.followUpDate === tomorrowStr) {
            rowClass = 'follow-up-upcoming';
        }
    }
}

        table.innerHTML += `
        <tr class="${rowClass}">
            <td>${c.caseNumber}</td>
            <td><span class="${statusClass}">${c.status || '-'}</span></td>
            <td>${c.subStatus || '-'}</td>
            <td>${c.createdAt || '-'}</td>
            <td>${c.updatedAt || '-'}</td>
            <td>${followUpDisplay}</td>
            <td>${c.noteAdded ? '✅' : '❌'}</td>
            <td>${c.emailSent ? '✅' : '❌'}</td>
            <td>${c.qplusDone ? '✅' : '❌'}</td>
            <td>
                <button class="view-btn" onclick="viewCase(${c.id})">Ver</button>
                <button class="edit-btn" onclick="editCase(${c.id})">Editar</button>
                <button class="delete-btn" onclick="deleteCase(${c.id})">Excluir</button>
            </td>
        </tr>
        `;
    });
}
// =============================================
// LIMPAR FILTROS
// =============================================

function clearFilters() {
    document.getElementById("search").value         = "";
    document.getElementById("filterStatus").value   = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value   = "";
    renderCases();
}

// =============================================
// FILTRO GLOBAL DE PERÍODO
// Afeta Dashboard e Gráficos
// =============================================

function applyGlobalFilter() {
    updateDashboard();
}

function clearGlobalFilter() {
    document.getElementById("globalDateFrom").value = "";
    document.getElementById("globalDateTo").value   = "";
    updateDashboard();
}

function getGlobalFilteredCases() {
    const globalFrom = (document.getElementById("globalDateFrom").value || "");
    const globalTo   = (document.getElementById("globalDateTo").value || "");

    return cases.filter(c => {
        const dateISO = getCreatedDateISO(c);
        if (globalFrom && dateISO && dateISO < globalFrom) return false;
        if (globalTo   && dateISO && dateISO > globalTo)   return false;
        return true;
    });
}

// =============================================
// DASHBOARD E GRÁFICO
// Casos "Discarded" são EXCLUÍDOS dos cálculos
// Aplica filtro global de período
// =============================================

let chart;

function updateDashboard() {
    // Aplicar filtro global de período
    const filteredCases = getGlobalFilteredCases();

    // Casos válidos = todos exceto Discarded
    const validCases   = filteredCases.filter(c => c.status !== "Discarded");
    const total        = validCases.length;

    const needInfo     = validCases.filter(c => c.status === "Need Info").length;
    const implemented  = validCases.filter(c => c.status === "Implemented").length;
    const inactive     = validCases.filter(c => c.status === "Inactive").length;

    // Discarded: contagem separada (exibida no card, mas fora dos gráficos)
    const discarded    = filteredCases.filter(c => c.status === "Discarded").length;

    const pct = (n) => total ? ((n / total) * 100).toFixed(1) : 0;

    document.getElementById("totalCases").textContent      = total;
    document.getElementById("needInfoCount").innerHTML     = `${needInfo}<br><small>${pct(needInfo)}%</small>`;
    document.getElementById("implementedCount").innerHTML  = `${implemented}<br><small>${pct(implemented)}%</small>`;
    document.getElementById("inactiveCount").innerHTML     = `${inactive}<br><small>${pct(inactive)}%</small>`;
    document.getElementById("discardedCount").textContent  = discarded;

    // Gráfico de pizza — apenas casos válidos
    const ctx = document.getElementById("statusChart");

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: [
                `Need Info (${pct(needInfo)}%)`,
                `Implemented (${pct(implemented)}%)`,
                `Inactive (${pct(inactive)}%)`
            ],
            datasets: [{
                data: [needInfo, implemented, inactive],
                backgroundColor: [
                    "#f39c12",
                    "#27ae60",
                    "#e74c3c"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

// =============================================
// SALVAR / EDITAR CASO
// =============================================

function saveCase() {
    if (editingCaseId) {
        updateCase();
    } else {
        addCase();
    }
}

function editCase(id) {
    const caseData = cases.find(c => c.id === id);
    if (!caseData) return;

    editingCaseId = id;

    document.getElementById("caseNumber").value = caseData.caseNumber;
    document.getElementById("status").value = caseData.status;

    // Dispara change para popular substatus e exibir Follow Up
    statusSelect.dispatchEvent(new Event("change"));

    document.getElementById("subStatus").value = caseData.subStatus || "";
    document.getElementById("notes").value = caseData.notes || "";
    document.getElementById("noteAdded").checked = caseData.noteAdded || false;
    document.getElementById("emailSent").checked = caseData.emailSent || false;
    document.getElementById("qplusDone").checked = caseData.qplusDone || false;

    // Restaurar Follow Up
    document.getElementById("followUpDate").value = caseData.followUpDate || "";
    document.getElementById("followUpNA").checked = caseData.followUpNA || false;

    document.getElementById("saveButton").textContent = "Atualizar Caso";

    // Rolar até o formulário
    document.querySelector(".form").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function updateCase() {
    const index = cases.findIndex(c => c.id === editingCaseId);
    if (index === -1) return;

    const status = document.getElementById("status").value;

    // Validar Follow Up para Need Info, Inactive e Implemented
    let followUpDate = "";
    let followUpNA = false;
    const statusesComFollowUp = ["Need Info", "Inactive", "Implemented"];
    
    if (statusesComFollowUp.includes(status)) {
        followUpDate = document.getElementById("followUpDate").value;
        followUpNA = document.getElementById("followUpNA").checked;
        if (!followUpDate && !followUpNA) {
            alert(`Para ${status}, informe uma data de Follow Up ou marque N/A`);
            return;
        }
    }

    cases[index] = {
        ...cases[index],
        caseNumber:   document.getElementById("caseNumber").value.trim(),
        status,
        subStatus:    document.getElementById("subStatus").value,
        notes:        document.getElementById("notes").value,
        followUpDate: followUpDate,
        followUpNA:   followUpNA,
        noteAdded:    document.getElementById("noteAdded").checked,
        emailSent:    document.getElementById("emailSent").checked,
        qplusDone:    document.getElementById("qplusDone").checked,
        updatedAt:    new Date().toLocaleString()
    };

    saveStorage();
    renderCases();
    updateDashboard();
    updateFollowUpAlerts();
    clearForm();

    editingCaseId = null;
    document.getElementById("saveButton").textContent = "Salvar Caso";
}

// =============================================
// LIMPAR FORMULÁRIO
// =============================================

function clearForm() {
    document.getElementById("caseNumber").value  = "";
    document.getElementById("status").value       = "";
    document.getElementById("subStatus").innerHTML = '<option value="">Selecione Substatus</option>';
    document.getElementById("notes").value        = "";
    document.getElementById("noteAdded").checked  = false;
    document.getElementById("emailSent").checked  = false;
    document.getElementById("qplusDone").checked  = false;
    document.getElementById("followUpDate").value = "";
    document.getElementById("followUpNA").checked = false;
    followUpSection.style.display = "none";
}

// =============================================
// ALERTAS DE FOLLOW UP
// Apenas casos com Follow Up definido (não N/A)
// =============================================

function updateFollowUpAlerts() {
    const today = new Date().toISOString().split("T")[0];

    // Casos com Follow Up definido (não N/A e não Discarded)
    const casesComFollowUp = cases.filter(c => 
        c.status !== "Discarded" && 
        c.followUpDate && 
        !c.followUpNA
    );

    const overdue = casesComFollowUp.filter(c =>
        c.followUpDate < today
    );

    const todayCases = casesComFollowUp.filter(c =>
        c.followUpDate === today
    );

    const div = document.getElementById("followUpAlerts");
    let html = "";

    if (overdue.length) {
        html += `
        <div class="alert overdue">
            ⚠️ Follow Ups Vencidos: ${overdue.length}
        </div>
        `;
    }

    if (todayCases.length) {
        html += `
        <div class="alert today">
            📅 Follow Ups Hoje: ${todayCases.length}
        </div>
        `;
    }

    div.innerHTML = html;
}

function formatDateBR(dateString) {

    if (!dateString) return "-";

    const [year, month, day] = dateString.split("-");

    return `${day}/${month}/${year}`;
}


function viewCase(id){

    const c = cases.find(x => x.id === id);

    if(!c) return;

    let followUpDisplay = "N/A";

    if(!c.followUpNA && c.followUpDate){
        followUpDisplay = c.followUpDate;
    }

    document.getElementById("modalBody").innerHTML = `

 <div class="case-header">
    <h3>Caso #${c.caseNumber}</h3>
    <span class="${getStatusClass(c.status)} status-badge">
    ${c.status}
</span>
</div>

<div class="details-grid">

    <div class="detail-card">
        <strong>Substatus</strong>
        <p>${c.subStatus || "-"}</p>
    </div>

    <div class="detail-card">
        <strong>Follow Up</strong>
        <p>${followUpDisplay}</p>
    </div>

    <div class="detail-card">
        <strong>Criado</strong>
        <p>${c.createdAt || "-"}</p>
    </div>

    <div class="detail-card">
        <strong>Atualizado</strong>
        <p>${c.updatedAt || "-"}</p>
    </div>

</div>

<div class="flags-section">

    <span class="flag-badge">
        ${c.noteAdded ? "✅" : "❌"} Nota
    </span>

    <span class="flag-badge">
        ${c.emailSent ? "✅" : "❌"} Email
    </span>

    <span class="flag-badge">
        ${c.qplusDone ? "✅" : "❌"} QPlus
    </span>

</div>

<div class="observations-section">

    <h4>📝 Observações</h4>

    <div class="observations-box">
        ${c.observations || "Nenhuma observação"}
    </div>

</div>

`;


    document.getElementById("viewModal").style.display = "block";
}

function closeViewModal(){
    document.getElementById("viewModal").style.display = "none";
}

window.onclick = function(event) {

    const modal = document.getElementById("viewModal");

    if (event.target === modal) {
        closeViewModal();
    }

};

function toggleTheme(){

    document.body.classList.toggle("dark-mode");

    const isDark =
        document.body.classList.contains("dark-mode");

    localStorage.setItem(
        "theme",
        isDark ? "dark" : "light"
    );

    document.getElementById("themeToggle").textContent =
        isDark
            ? "☀️ Light Mode"
            : "🌙 Dark Mode";
}



// =============================================
// INICIALIZAÇÃO
// =============================================

renderCases();
updateDashboard();
updateFollowUpAlerts();
