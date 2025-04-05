document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFileInput');
    const customerTableBody = document.getElementById('customerTableBody');
    const customerListSection = document.getElementById('customerListSection');
    const errorMessageDiv = document.getElementById('errorMessage');
    const noDataMessage = document.getElementById('noDataMessage');

    const STORAGE_KEY = 'claimedCustomers'; // Key for localStorage

    let customerData = []; // To hold the parsed customer data

    // --- Event Listeners ---
    csvFileInput.addEventListener('change', handleFileUpload);
    customerTableBody.addEventListener('change', handleCheckboxChange); // Event delegation

    // --- Functions ---

    // Load data from localStorage on page load
    function loadInitialData() {
        // For this app, we don't load the table from localStorage,
        // only the claimed status. The user needs to upload the CSV each time
        // or we'd need to store the full CSV data too, which can get large.
        // So, we just wait for upload. If you wanted to persist the table:
        // const storedData = localStorage.getItem('fullCustomerData');
        // if (storedData) {
        //    customerData = JSON.parse(storedData);
        //    renderTable();
        // }
        console.log("Ready for CSV upload.");
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            displayError("No file selected.");
            return;
        }
        if (!file.name.toLowerCase().endsWith('.csv')) {
            displayError("Please upload a valid .csv file.");
            return;
        }

        clearError();
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const text = e.target.result;
                customerData = parseCSV(text);
                if(customerData.length > 0) {
                    renderTable();
                    noDataMessage.style.display = 'none';
                } else {
                    customerTableBody.innerHTML = ''; // Clear table
                    noDataMessage.style.display = 'block';
                }
                customerListSection.style.display = 'block'; // Show the table section
            } catch (error) {
                console.error("Error parsing CSV:", error);
                displayError("Could not parse the CSV file. Ensure it's correctly formatted.");
                customerListSection.style.display = 'none';
            }
        };

        reader.onerror = function() {
            console.error("FileReader error:", reader.error);
            displayError("Error reading the file.");
            customerListSection.style.display = 'none';
        };

        reader.readAsText(file);
    }

    // Basic CSV parser (handles simple quotes and commas)
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return []; // Need header + at least one data row

        const headers = lines[0].trim().split(',').map(h => h.trim());
        // Find column indices - adjust these names if your CSV header is different!
        const nameIndex = headers.indexOf("Name");
        const mobileIndex = headers.indexOf("Mobile Number");
        const emailIndex = headers.indexOf("Email");
        const cityIndex = headers.indexOf("City");
        const ordersIndex = headers.indexOf("Total Orders");
        const salesIndex = headers.indexOf("Total Sales");

        if ([nameIndex, mobileIndex, ordersIndex].some(index => index === -1)) {
             throw new Error("CSV must contain 'Name', 'Mobile Number', and 'Total Orders' headers.");
        }

        const data = [];
        const claimedSet = loadClaimedStatus(); // Load claimed status initially

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            // Simple split, may need improvement for complex CSVs with quoted commas
            const values = line.split(','); // Consider a more robust library for complex CSVs

            if (values.length === headers.length) {
                const mobile = values[mobileIndex]?.trim() || `row-${i}`; // Use mobile or row index as unique ID
                 data.push({
                    id: mobile, // Use mobile as a unique identifier
                    name: values[nameIndex]?.trim(),
                    mobile: values[mobileIndex]?.trim(),
                    email: values[emailIndex]?.trim() || 'N/A',
                    city: values[cityIndex]?.trim() || 'N/A',
                    orders: values[ordersIndex]?.trim() || '0',
                    sales: values[salesIndex]?.trim() || 'N/A',
                    claimed: claimedSet.has(mobile) // Check if this ID was claimed before
                });
            } else {
                console.warn(`Skipping malformed line ${i + 1}: ${line}`);
            }
        }
        return data;
    }

    function renderTable() {
        customerTableBody.innerHTML = ''; // Clear previous rows

        if (customerData.length === 0) {
             noDataMessage.style.display = 'block';
            return;
        }
         noDataMessage.style.display = 'none';

        customerData.forEach((customer, index) => {
            const row = document.createElement('tr');
            row.dataset.customerId = customer.id; // Store unique ID on the row

            if (customer.claimed) {
                row.classList.add('claimed');
            }

            // Use innerHTML for simplicity here, could create elements individually too
            row.innerHTML = `
                <td>${customer.name || ''}</td>
                <td>${customer.mobile || ''}</td>
                <td>${customer.email || ''}</td>
                <td>${customer.city || ''}</td>
                <td>${customer.orders || ''}</td>
                <td>${customer.sales || ''}</td>
                <td>
                    <input type="checkbox" ${customer.claimed ? 'checked' : ''} aria-label="Mark ${customer.name} as claimed">
                </td>
            `;
            customerTableBody.appendChild(row);
        });
    }

    function handleCheckboxChange(event) {
        if (event.target.type === 'checkbox') {
            const checkbox = event.target;
            const row = checkbox.closest('tr'); // Find the parent table row
            if (!row) return;

            const customerId = row.dataset.customerId; // Get the unique ID
            const isClaimed = checkbox.checked;

            // Update the row's appearance
            row.classList.toggle('claimed', isClaimed);

            // Update the internal data state (optional but good practice)
            const customer = customerData.find(c => c.id === customerId);
            if (customer) {
                customer.claimed = isClaimed;
            }

            // Update localStorage
            saveClaimedStatus(customerId, isClaimed);
        }
    }

    function saveClaimedStatus(customerId, isClaimed) {
        const claimedSet = loadClaimedStatus();
        if (isClaimed) {
            claimedSet.add(customerId);
        } else {
            claimedSet.delete(customerId);
        }
        // Convert Set to Array for storing in localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(claimedSet)));
        // console.log("Updated claimed status:", Array.from(claimedSet));
    }

    function loadClaimedStatus() {
        const storedStatus = localStorage.getItem(STORAGE_KEY);
        if (storedStatus) {
            try {
                // Convert stored Array back to Set
                return new Set(JSON.parse(storedStatus));
            } catch (e) {
                console.error("Error parsing claimed status from localStorage:", e);
                return new Set(); // Return empty set on error
            }
        }
        return new Set(); // Return empty set if nothing is stored
    }

    function displayError(message) {
        errorMessageDiv.textContent = message;
    }

    function clearError() {
        errorMessageDiv.textContent = '';
    }

    // --- Initial Load ---
    loadInitialData();

}); // End DOMContentLoaded