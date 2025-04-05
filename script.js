document.addEventListener('DOMContentLoaded', () => {
    const csvFileInput = document.getElementById('csvFileInput');
    const customerTableBody = document.getElementById('customerTableBody');
    const customerListSection = document.getElementById('customerListSection');
    const errorMessageDiv = document.getElementById('errorMessage');
    const noDataMessage = document.getElementById('noDataMessage');

    const CLAIMED_STORAGE_KEY = 'claimedCustomers'; // Key for claimed status
    const DATA_STORAGE_KEY = 'lastUploadedCustomerData'; // Key for the actual data

    let customerData = []; // To hold the parsed customer data globally in the script

    // --- Event Listeners ---
    csvFileInput.addEventListener('change', handleFileUpload);
    customerTableBody.addEventListener('change', handleCheckboxChange); // Event delegation

    // --- Functions ---

    // Load data from localStorage on page load
    function loadInitialData() {
        const storedDataString = localStorage.getItem(DATA_STORAGE_KEY);
        if (storedDataString) {
            try {
                customerData = JSON.parse(storedDataString); // Load data into our global variable
                // IMPORTANT: We need to re-apply the claimed status from its separate storage
                const claimedSet = loadClaimedStatus();
                customerData.forEach(customer => {
                    customer.claimed = claimedSet.has(customer.id);
                });

                console.log("Loaded data from localStorage.");
                if(customerData.length > 0) {
                    renderTable();
                    customerListSection.style.display = 'block'; // Show table section
                    noDataMessage.style.display = 'none';
                } else {
                    // Stored data was empty array
                    customerListSection.style.display = 'none';
                    noDataMessage.style.display = 'none'; // No data *yet*, wait for upload
                }

            } catch (error) {
                console.error("Error parsing stored customer data:", error);
                localStorage.removeItem(DATA_STORAGE_KEY); // Clear corrupted data
                customerListSection.style.display = 'none'; // Hide table section
                noDataMessage.style.display = 'none'; // Wait for upload
            }
        } else {
             console.log("No previous data found in localStorage. Waiting for upload.");
             customerListSection.style.display = 'none'; // Hide section until upload
             noDataMessage.style.display = 'none';
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        // Reset input value so the 'change' event fires even if the same file is selected again
        event.target.value = null;
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
                // Parse the new data (this applies currently stored claimed status)
                const newData = parseCSV(text);
                customerData = newData; // Replace global data with newly parsed data

                // *** SAVE the newly parsed data to localStorage ***
                localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(customerData));
                console.log("Saved new data to localStorage.");

                if(customerData.length > 0) {
                    renderTable(); // Render with the new data
                    noDataMessage.style.display = 'none';
                } else {
                    customerTableBody.innerHTML = ''; // Clear table
                    noDataMessage.style.display = 'block';
                }
                customerListSection.style.display = 'block'; // Show the table section

            } catch (error) {
                console.error("Error parsing CSV:", error);
                displayError("Could not parse the CSV file. Ensure it's correctly formatted.");
                // Don't hide the section if there was already data displayed
                // customerListSection.style.display = 'none';
            }
        };

        reader.onerror = function() {
            console.error("FileReader error:", reader.error);
            displayError("Error reading the file.");
           // customerListSection.style.display = 'none';
        };

        reader.readAsText(file);
    }

    // Parse CSV text into an array of objects
    // Now also applies currently loaded claimed status
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].trim().split(',').map(h => h.trim());
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
        const claimedSet = loadClaimedStatus(); // Load currently stored claimed status

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(','); // Basic split

            if (values.length === headers.length) {
                 const mobile = values[mobileIndex]?.trim() || `row-${i}`;
                 data.push({
                    id: mobile,
                    name: values[nameIndex]?.trim(),
                    mobile: values[mobileIndex]?.trim(),
                    email: values[emailIndex]?.trim() || 'N/A',
                    city: values[cityIndex]?.trim() || 'N/A',
                    orders: values[ordersIndex]?.trim() || '0',
                    sales: values[salesIndex]?.trim() || 'N/A',
                    claimed: claimedSet.has(mobile) // Check against current claimed status
                });
            } else {
                console.warn(`Skipping malformed line ${i + 1}: ${line}`);
            }
        }
        return data;
    }

    function renderTable() {
        customerTableBody.innerHTML = ''; // Clear previous rows

        if (!customerData || customerData.length === 0) {
             noDataMessage.style.display = 'block';
             customerListSection.style.display = 'none'; // Hide if no data
            return;
        }

        customerListSection.style.display = 'block'; // Ensure section is visible
        noDataMessage.style.display = 'none';

        const claimedSet = loadClaimedStatus(); // Get current claimed status

        customerData.forEach((customer) => {
            const row = document.createElement('tr');
            // Ensure customer.id exists; use mobile as fallback if needed during potential transitions
            const currentId = customer.id || customer.mobile || `temp-${Math.random()}`;
             row.dataset.customerId = currentId;

            // Determine claimed status based on the loaded set
            const isCurrentlyClaimed = claimedSet.has(currentId);
            customer.claimed = isCurrentlyClaimed; // Sync object state if needed

            if (isCurrentlyClaimed) {
                row.classList.add('claimed');
            }

            row.innerHTML = `
                <td>${customer.name || ''}</td>
                <td>${customer.mobile || ''}</td>
                <td>${customer.email || ''}</td>
                <td>${customer.city || ''}</td>
                <td>${customer.orders || ''}</td>
                <td>${customer.sales || ''}</td>
                <td>
                    <input type="checkbox" ${isCurrentlyClaimed ? 'checked' : ''} aria-label="Mark ${customer.name} as claimed">
                </td>
            `;
            customerTableBody.appendChild(row);
        });
    }

    function handleCheckboxChange(event) {
        if (event.target.type === 'checkbox') {
            const checkbox = event.target;
            const row = checkbox.closest('tr');
            if (!row) return;

            const customerId = row.dataset.customerId;
            const isClaimed = checkbox.checked;

            row.classList.toggle('claimed', isClaimed);

            // Find customer in global data and update state (optional but good)
            const customer = customerData.find(c => c.id === customerId);
            if (customer) {
                customer.claimed = isClaimed;
                // No need to re-save the full customerData here, just the claimed status ID
            } else {
                console.warn("Could not find customer in data array for ID:", customerId);
            }

            // Update the separate claimed status localStorage
            saveClaimedStatus(customerId, isClaimed);
        }
    }

    // Saves only the SET of claimed IDs
    function saveClaimedStatus(customerId, isClaimed) {
        const claimedSet = loadClaimedStatus();
        if (isClaimed) {
            claimedSet.add(customerId);
        } else {
            claimedSet.delete(customerId);
        }
        localStorage.setItem(CLAIMED_STORAGE_KEY, JSON.stringify(Array.from(claimedSet)));
         // console.log("Updated claimed status:", Array.from(claimedSet));
    }

    // Loads only the SET of claimed IDs
    function loadClaimedStatus() {
        const storedStatus = localStorage.getItem(CLAIMED_STORAGE_KEY);
        if (storedStatus) {
            try {
                return new Set(JSON.parse(storedStatus));
            } catch (e) {
                console.error("Error parsing claimed status from localStorage:", e);
                return new Set();
            }
        }
        return new Set();
    }

    function displayError(message) {
        errorMessageDiv.textContent = message;
    }

    function clearError() {
        errorMessageDiv.textContent = '';
    }

    // --- Initial Load ---
    loadInitialData(); // This will now try to load and render data from localStorage

}); // End DOMContentLoaded
