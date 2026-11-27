document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // 1. APPLICATION STATE
    // =====================================

    const state = {
        tasks: [],
        collisions: null,
        dailyHours: 3,
        startDate: "",
        currentPage: "overview"
    };

    const pages = {
        overview: "Overview",
        inbox: "Smart Inbox",
        deadlines: "Deadline Hub",
        collisions: "Collision Radar",
        recovery: "Recovery Plan",
        simulator: "What-If Simulator",
        extension: "Extension Assistant"
    };

    const $ = id => document.getElementById(id);


    // =====================================
    // 2. UTILITY FUNCTIONS
    // =====================================

    function refreshIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function getLocalDate() {

        const today = new Date();

        return (
            `${today.getFullYear()}-` +
            `${String(today.getMonth() + 1).padStart(2, "0")}-` +
            `${String(today.getDate()).padStart(2, "0")}`
        );
    }

    function formatDate(value) {

        if (!value) {
            return "Not confirmed";
        }

        return new Date(`${value}T00:00:00`)
            .toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
    }

    function formatHours(value) {

        if (value === null || value === undefined) {
            return "Unknown";
        }

        return `${Number(Number(value).toFixed(2))}h`;
    }

    function createElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function showToast(message, type = "success") {

        const toast = createElement(
            "div",
            `toast ${type}`,
            message
        );

        $("toast-container").appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    function showLoading(container, message = "Loading...") {

        container.replaceChildren();

        const wrapper = createElement(
            "div",
            "loading-state"
        );

        wrapper.append(
            createElement("span", "spinner"),
            createElement("span", "", message)
        );

        container.appendChild(wrapper);
    }

    function createAlert(type, title, message) {

        const alert = createElement(
            "div",
            `alert alert-${type}`
        );

        alert.append(
            createElement("strong", "", title),
            createElement("p", "", message)
        );

        return alert;
    }

    function createBadge(text, type = "neutral") {

        return createElement(
            "span",
            `badge badge-${type}`,
            text
        );
    }


    // =====================================
    // 3. API CONNECTION
    // =====================================

    async function apiRequest(endpoint, options = {}) {

        const response = await fetch(endpoint, options);

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                `Invalid server response (${response.status})`
            );
        }

        if (!response.ok || data.success === false) {

            throw new Error(
                data.error ||
                data.message ||
                `Request failed (${response.status})`
            );
        }

        return data;
    }

    function planningQuery() {

        return new URLSearchParams({
            daily_hours: state.dailyHours,
            start_date: state.startDate
        }).toString();
    }

    async function checkHealth() {

        const status = $("system-status");

        try {

            const data = await apiRequest("/api/health");

            if (data.status !== "healthy") {
                throw new Error("Backend unavailable");
            }

            status.classList.remove("offline");

            status.replaceChildren(
                createElement("span", "online-dot"),
                document.createTextNode("Backend online")
            );

        } catch (error) {

            status.classList.add("offline");

            status.replaceChildren(
                createElement("span", "online-dot"),
                document.createTextNode("Backend offline")
            );

            console.error(error);
        }
    }

    async function loadTasks() {

        const data = await apiRequest("/api/tasks");

        state.tasks = data.tasks;

        return state.tasks;
    }

    async function loadCollisions() {

        const data = await apiRequest(
            `/api/collisions?${planningQuery()}`
        );

        state.collisions = data;

        return data;
    }


    // =====================================
    // 4. NAVIGATION
    // =====================================

    function showPage(page) {

        if (!Object.hasOwn(pages, page)) {
            page = "overview";
        }

        state.currentPage = page;

        document.querySelectorAll(".page")
            .forEach(section => {
                section.classList.remove("active");
            });

        document.querySelectorAll(".nav-item")
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page === page
                );

            });

        $(`page-${page}`).classList.add("active");

        $("current-page-label").textContent = pages[page];

        history.replaceState(null, "", `#${page}`);

        $("sidebar").classList.remove("open");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        refreshIcons();
    }

    document.querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener("click", () => {
                showPage(button.dataset.page);
            });

        });

    document.querySelectorAll("[data-go]")
        .forEach(button => {

            button.addEventListener("click", () => {
                showPage(button.dataset.go);
            });

        });

    $("menu-toggle").addEventListener("click", () => {

        $("sidebar").classList.toggle("open");

    });

    window.addEventListener("hashchange", () => {

        showPage(
            window.location.hash.slice(1) || "overview"
        );

    });


    // =====================================
    // 5. DASHBOARD STATISTICS
    // =====================================

    function renderStatistics() {

        const activeTasks = state.tasks.filter(
            task => task.status !== "completed"
        );

        const completedTasks = state.tasks.filter(
            task => task.status === "completed"
        );

        $("stat-active").textContent =
            activeTasks.length;

        $("stat-completed").textContent =
            completedTasks.length;

        $("stat-collisions").textContent =
            state.collisions?.collision_count ?? "—";

        $("stat-hours").textContent =
            state.collisions
                ? formatHours(
                    state.collisions.total_remaining_hours
                )
                : "—";
    }


    // =====================================
    // 6. UPCOMING DEADLINES
    // =====================================

    function renderUpcomingDeadlines() {

        const container = $("overview-deadlines");

        container.replaceChildren();

        const upcoming = state.tasks
            .filter(task =>
                task.status !== "completed" &&
                task.due_date &&
                task.due_date >= state.startDate &&
                !task.needs_confirmation
            )
            .sort((a, b) =>
                a.due_date.localeCompare(b.due_date)
            )
            .slice(0, 5);

        if (upcoming.length === 0) {

            container.appendChild(
                createAlert(
                    "info",
                    "No confirmed upcoming deadlines.",
                    "Add deadlines through your Smart Inbox."
                )
            );

            return;
        }

        upcoming.forEach(task => {

            const row = createElement(
                "div",
                "deadline-row"
            );

            const marker = createElement(
                "span",
                "deadline-marker"
            );

            if (task.priority === "high") {
                marker.style.background = "var(--orange)";
            } else if (task.priority === "medium") {
                marker.style.background = "var(--pink)";
            } else {
                marker.style.background = "var(--green)";
            }

            const content = createElement(
                "div",
                "deadline-row-content"
            );

            content.append(
                createElement(
                    "strong",
                    "",
                    task.task
                ),

                createElement(
                    "p",
                    "",
                    `${task.subject} · ${formatDate(task.due_date)}`
                )
            );

            row.append(
                marker,
                content,
                createBadge(task.priority, task.priority)
            );

            container.appendChild(row);

        });
    }


    // =====================================
    // 7. WORKLOAD OUTLOOK
    // =====================================

    function renderWorkloadOutlook() {

        const container = $("overview-risk");

        container.replaceChildren();

        const analysis = state.collisions;

        if (!analysis) {

            container.appendChild(
                createAlert(
                    "warning",
                    "Analysis unavailable",
                    "Try updating your planning settings."
                )
            );

            return;
        }

        if (analysis.collision_detected) {

            const maximumDeficit = Math.max(
                0,
                ...analysis.collisions.map(
                    item => item.deficit_hours
                )
            );

            container.appendChild(
                createAlert(
                    "danger",
                    "Academic overload detected!",
                    `${analysis.collision_count} overloaded checkpoint(s). ` +
                    `Maximum cumulative shortage: ${formatHours(maximumDeficit)}.`
                )
            );

        } else if (analysis.total_active_tasks === 0) {

            container.appendChild(
                createAlert(
                    "info",
                    "Nothing to analyze yet.",
                    "Add confirmed deadlines with estimated study hours."
                )
            );

        } else {

            container.appendChild(
                createAlert(
                    "success",
                    "Your workload looks manageable!",
                    `Your confirmed upcoming tasks fit within your ` +
                    `${state.dailyHours} hours/day study capacity.`
                )
            );
        }

        const excluded =
            analysis.excluded_task_ids?.length || 0;

        const overdue =
            analysis.overdue_task_ids?.length || 0;

        if (excluded > 0) {

            container.appendChild(
                createAlert(
                    "warning",
                    `${excluded} task(s) excluded from planning`,
                    "Some tasks need confirmation, a deadline or an effort estimate."
                )
            );
        }

        if (overdue > 0) {

            container.appendChild(
                createAlert(
                    "danger",
                    `${overdue} task(s) before your planning date`,
                    "Review these separately in your Deadline Hub."
                )
            );
        }

        const checkpoints = analysis.checkpoints || [];

        if (checkpoints.length > 0) {

            const highest = [...checkpoints].sort(
                (a, b) =>
                    b.deficit_hours - a.deficit_hours ||
                    (b.utilization ?? 0) - (a.utilization ?? 0)
            )[0];

            const riskRow = createElement(
                "div",
                "metric-row"
            );

            riskRow.append(
                createElement("span", "", "Highest workload risk"),
                createBadge(highest.risk, highest.risk)
            );

            container.appendChild(riskRow);

            const dateRow = createElement(
                "div",
                "metric-row"
            );

            dateRow.append(
                createElement("span", "", "Critical checkpoint"),
                createElement(
                    "strong",
                    "",
                    formatDate(highest.deadline)
                )
            );

            container.appendChild(dateRow);
        }
    }


    // =====================================
    // 8. REFRESH DASHBOARD
    // =====================================

    async function refreshDashboard() {

        showLoading(
            $("overview-deadlines"),
            "Loading deadlines..."
        );

        showLoading(
            $("overview-risk"),
            "Analyzing workload..."
        );

        try {

            await Promise.all([
                loadTasks(),
                loadCollisions()
            ]);

            renderStatistics();
            renderUpcomingDeadlines();
            renderWorkloadOutlook();
            renderTaskList();
            renderCollisionRadar();
            populateSimulatorTasks();
            populateExtensionTasks();

        } catch (error) {

            $("overview-deadlines").replaceChildren(
                createAlert(
                    "danger",
                    "Unable to load dashboard",
                    error.message
                )
            );

            $("overview-risk").replaceChildren(
                createAlert(
                    "warning",
                    "Workload analysis unavailable",
                    "Check your Flask server and try again."
                )
            );

            state.collisions = null;
            renderCollisionRadar();

            showToast(error.message, "error");

            console.error(error);
        }

        refreshIcons();
    }


    // =====================================
    // 9. GLOBAL PLANNING SETTINGS
    // =====================================

    $("apply-settings").addEventListener("click", async () => {

        const hours = Number($("daily-hours").value);
        const startDate = $("start-date").value;

        if (
            $("daily-hours").value === "" ||
            !Number.isFinite(hours) ||
            hours < 0 ||
            hours > 24
        ) {

            showToast(
                "Study hours must be between 0 and 24.",
                "error"
            );

            return;
        }

        if (!startDate) {

            showToast(
                "Please select a planning date.",
                "error"
            );

            return;
        }

        state.dailyHours = hours;
        state.startDate = startDate;

        const button = $("apply-settings");

        button.disabled = true;

        try {

            await refreshDashboard();

        } finally {

            button.disabled = false;
        }

    });

        // =====================================
    // SMART INBOX — AI EXTRACTION
    // =====================================

    let extractedTasks = [];
    let extractionSource = "text";
    let previewURL = null;

    function setExtractionBusy(busy) {

        $("extract-text").disabled = busy;
        $("extract-image").disabled = busy;
        $("save-extracted").disabled =
            busy || extractedTasks.length === 0;
    }


    // LOAD SAMPLE MESSAGE

    $("load-sample").addEventListener("click", () => {

        $("message-input").value =
            "Guys DBMS assignment 30 November 2026 tak submit karni hai.\n\n" +
            "DSA lab viva 1 December ko hai, BST aur heaps prepare kar lena.\n\n" +
            "SML project report 2 December tak submit karna hai.\n\n" +
            "MPCA quiz shayad next week hoga, abhi confirm nahi hai.\n\n" +
            "Also guys mess mein aaj pasta hai.";

        showToast("Sample message loaded.", "info");

    });


    // IMAGE PREVIEW

    $("image-input").addEventListener("change", () => {

        const file = $("image-input").files[0];
        const preview = $("image-preview");

        if (previewURL) {
            URL.revokeObjectURL(previewURL);
            previewURL = null;
        }

        preview.hidden = true;
        preview.removeAttribute("src");
        $("file-name").textContent = "";

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {

            showToast(
                "Please select a PNG, JPG or WEBP image.",
                "error"
            );

            $("image-input").value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {

            showToast(
                "Image must be smaller than 5 MB.",
                "error"
            );

            $("image-input").value = "";
            return;
        }

        previewURL = URL.createObjectURL(file);

        preview.src = previewURL;
        preview.hidden = false;

        $("file-name").textContent = file.name;

    });


    // TEXT EXTRACTION

    $("extract-text").addEventListener("click", async () => {

        const message = $("message-input").value.trim();

        if (!message) {

            showToast(
                "Please paste a message first.",
                "error"
            );

            return;
        }

        await runExtraction(
            "/api/extract/text",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message })
            },
            "text"
        );

    });


    // SCREENSHOT EXTRACTION

    $("extract-image").addEventListener("click", async () => {

        const file = $("image-input").files[0];

        if (!file) {

            showToast(
                "Please select a screenshot first.",
                "error"
            );

            return;
        }

        const formData = new FormData();

        formData.append("image", file);

        await runExtraction(
            "/api/extract/image",
            {
                method: "POST",
                body: formData
            },
            "image"
        );

    });


    // COMMON EXTRACTION FUNCTION

    async function runExtraction(endpoint, options, source) {

        const container = $("extraction-results");

        extractedTasks = [];
        extractionSource = source;

        setExtractionBusy(true);

        container.className = "result-area";

        showLoading(
            container,
            "AI is identifying academic deadlines..."
        );

        try {

            const data = await apiRequest(
                endpoint,
                options
            );

            extractedTasks = data.tasks.map(task => ({

                ...task,

                selected:
                    !task.duplicate_analysis ||
                    task.duplicate_analysis.classification === "new"

            }));

            renderExtractedTasks();

            showToast(
                `${extractedTasks.length} deadline(s) extracted.`
            );

        } catch (error) {

            container.replaceChildren(
                createAlert(
                    "danger",
                    "Extraction failed",
                    error.message
                )
            );

            showToast(error.message, "error");

        } finally {

            setExtractionBusy(false);
            refreshIcons();

        }
    }


    // CREATE EDITABLE INPUT FIELD

    function createExtractionField(
        labelText,
        type,
        value,
        onChange
    ) {

        const group = createElement(
            "div",
            "form-group"
        );

        const label = createElement("label");

        label.appendChild(
            document.createTextNode(labelText)
        );

        const input = createElement("input");

        input.type = type;
        input.value = value ?? "";

        if (type === "number") {

            input.min = "0.5";
            input.max = "100";
            input.step = "0.5";

        }

        input.addEventListener("input", () => {

            onChange(input.value);

        });

        label.appendChild(input);
        group.appendChild(label);

        return group;
    }


    // RENDER EXTRACTED DEADLINE CARDS

    function renderExtractedTasks() {

        const container = $("extraction-results");

        container.className = "result-area";
        container.replaceChildren();

        if (extractedTasks.length === 0) {

            container.appendChild(
                createAlert(
                    "info",
                    "No academic deadlines found.",
                    "Try a message containing assignments, exams, projects or vivas."
                )
            );

            $("save-extracted").disabled = true;
            return;
        }

        container.appendChild(
            createAlert(
                "info",
                `${extractedTasks.length} deadline(s) identified`,
                "Review the AI-generated dates and effort estimates before saving."
            )
        );

        extractedTasks.forEach(task => {

            const card = createElement(
                "article",
                "extraction-card"
            );

            const header = createElement(
                "div",
                "task-card-header"
            );


            // SELECTION CHECKBOX

            const selectionLabel = createElement(
                "label",
                "checkbox-row"
            );

            const checkbox = createElement("input");

            checkbox.type = "checkbox";
            checkbox.checked = task.selected;

            checkbox.addEventListener("change", () => {

                task.selected = checkbox.checked;

            });

            selectionLabel.append(
                checkbox,
                document.createTextNode("Save this task")
            );

            header.append(
                selectionLabel,
                createBadge(
                    `${task.confidence} AI confidence`,
                    task.confidence === "high"
                        ? "success"
                        : "warning"
                )
            );

            card.appendChild(header);

            card.append(
                createElement("h3", "", task.task),
                createElement("p", "", task.description)
            );


            // EDITABLE SUBJECT AND TASK NAME

            const identityFields = createElement(
                "div",
                "two-column"
            );

            identityFields.append(

                createExtractionField(
                    "Subject",
                    "text",
                    task.subject,
                    value => {
                        task.subject = value;
                    }
                ),

                createExtractionField(
                    "Task name",
                    "text",
                    task.task,
                    value => {
                        task.task = value;
                    }
                )

            );

            card.appendChild(identityFields);


            // EDITABLE DEADLINE AND EFFORT

            const planningFields = createElement(
                "div",
                "two-column"
            );

            planningFields.append(

                createExtractionField(
                    "Deadline",
                    "date",
                    task.due_date,
                    value => {

                        task.due_date = value || null;

                        task.needs_confirmation = true;
                        confirmationCheckbox.checked = false;

                    }
                ),

                createExtractionField(
                    "Estimated study hours",
                    "number",
                    task.estimated_hours,
                    value => {

                        task.estimated_hours =
                            value === ""
                                ? null
                                : Number(value);

                        task.needs_confirmation = true;
                        confirmationCheckbox.checked = false;

                    }
                )

            );

            card.appendChild(planningFields);


            // PRIORITY

            const priorityGroup = createElement(
                "div",
                "form-group"
            );

            const priorityLabel = createElement(
                "label",
                "",
                "Priority"
            );

            const prioritySelect = createElement("select");

            ["low", "medium", "high"].forEach(priority => {

                const option = createElement(
                    "option",
                    "",
                    priority.charAt(0).toUpperCase() +
                    priority.slice(1)
                );

                option.value = priority;

                prioritySelect.appendChild(option);

            });

            prioritySelect.value = task.priority;

            prioritySelect.addEventListener("change", () => {

                task.priority = prioritySelect.value;

            });

            priorityLabel.appendChild(prioritySelect);
            priorityGroup.appendChild(priorityLabel);
            card.appendChild(priorityGroup);


            // AMBIGUITY WARNING

            if (task.needs_confirmation) {

                card.appendChild(
                    createAlert(
                        "warning",
                        "Needs confirmation",
                        task.ambiguity_reason ||
                        "Verify the deadline and estimated effort."
                    )
                );

            }


            // DUPLICATE DETECTION

            const duplicate = task.duplicate_analysis;

            if (
                duplicate &&
                duplicate.classification !== "new"
            ) {

                const warning = createElement(
                    "div",
                    "duplicate-warning"
                );

                let title = "Possible existing task";

                if (
                    duplicate.classification === "duplicate"
                ) {

                    title = "Duplicate deadline detected";

                } else if (
                    duplicate.classification === "possible_reschedule"
                ) {

                    title = "Possible rescheduled deadline";

                }

                warning.append(

                    createElement("strong", "", title),

                    createElement(
                        "p",
                        "",
                        `Existing deadline: ${
                            formatDate(duplicate.existing_deadline)
                        }`
                    ),

                    createElement(
                        "p",
                        "",
                        `Extracted deadline: ${
                            formatDate(duplicate.new_deadline)
                        }`
                    ),

                    createElement(
                        "p",
                        "",
                        "This task is unselected by default. " +
                        "Select it only if you want to save a separate task."
                    )

                );

                card.appendChild(warning);

            }


            // CONFIRMATION CHECKBOX

            const confirmationLabel = createElement(
                "label",
                "checkbox-row"
            );

            const confirmationCheckbox = createElement(
                "input"
            );

            confirmationCheckbox.type = "checkbox";

            confirmationCheckbox.checked = false;

            task.needs_confirmation = true;

            confirmationCheckbox.addEventListener(
                "change",
                () => {

                    if (
                        confirmationCheckbox.checked &&
                        (
                            !task.due_date ||
                            !Number.isFinite(task.estimated_hours) ||
                            task.estimated_hours < 0.5 ||
                            task.estimated_hours > 100
                        )
                    ) {

                        confirmationCheckbox.checked = false;

                        showToast(
                            "Enter a valid deadline and study-hour estimate first.",
                            "error"
                        );

                        return;
                    }

                    task.needs_confirmation =
                        !confirmationCheckbox.checked;

                }
            );

            confirmationLabel.append(

                confirmationCheckbox,

                document.createTextNode(
                    "I have verified the deadline and estimated study hours."
                )

            );

            card.appendChild(confirmationLabel);


            // ORIGINAL SOURCE

            card.appendChild(
                createElement(
                    "div",
                    "task-source",
                    `Original source: ${task.source_text}`
                )
            );

            container.appendChild(card);

        });

        $("save-extracted").disabled = false;
    }


    // SAVE SELECTED DEADLINES

    $("save-extracted").addEventListener("click", async () => {

        const selectedTasks = extractedTasks.filter(
            task => task.selected
        );

        if (selectedTasks.length === 0) {

            showToast(
                "Select at least one deadline.",
                "error"
            );

            return;
        }

        for (const task of selectedTasks) {

            if (
                !task.subject.trim() ||
                !task.task.trim()
            ) {

                showToast(
                    "Subject and task name cannot be empty.",
                    "error"
                );

                return;
            }

            if (
                task.estimated_hours !== null &&
                (
                    !Number.isFinite(task.estimated_hours) ||
                    task.estimated_hours < 0.5 ||
                    task.estimated_hours > 100
                )
            ) {

                showToast(
                    "Estimated hours must be between 0.5 and 100.",
                    "error"
                );

                return;
            }

        }

        const tasksToSave = selectedTasks.map(task => {

            const {
                selected,
                duplicate_analysis,
                ...cleanTask
            } = task;

            cleanTask.subject = cleanTask.subject.trim();
            cleanTask.task = cleanTask.task.trim();

            if (!cleanTask.needs_confirmation) {

                cleanTask.ambiguity_reason = null;

            } else if (!cleanTask.ambiguity_reason) {

                cleanTask.ambiguity_reason =
                    "Deadline or effort has not been verified.";

            }

            return cleanTask;

        });

        setExtractionBusy(true);

        try {

            await apiRequest("/api/tasks", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    source_type: extractionSource,
                    tasks: tasksToSave

                })

            });

            const savedCount = tasksToSave.length;

            extractedTasks = extractedTasks.filter(
                task => !task.selected
            );

            if (extractedTasks.length > 0) {

                renderExtractedTasks();

            } else {

                $("extraction-results").replaceChildren(
                    createAlert(
                        "success",
                        "Deadlines saved successfully!",
                        `${savedCount} task(s) added to your Deadline Hub.`
                    )
                );

            }

            showToast(
                `${savedCount} deadline(s) saved successfully.`
            );

            await refreshDashboard();

        } catch (error) {

            showToast(error.message, "error");

        } finally {

            setExtractionBusy(false);

        }

    });

        // =====================================
    // DEADLINE HUB — TASK MANAGEMENT
    // =====================================

    function createActionButton(text, className, handler) {

        const button = createElement(
            "button",
            `button ${className}`,
            text
        );

        button.type = "button";

        button.addEventListener("click", handler);

        return button;
    }


    // RENDER ALL SAVED TASKS

    function renderTaskList() {

        const container = $("task-list");

        const search = $("task-search")
            .value.trim().toLowerCase();

        const filter = $("task-filter").value;

        container.replaceChildren();

        const filteredTasks = state.tasks.filter(task => {

            const searchableText = [
                task.subject,
                task.task,
                task.description
            ].join(" ").toLowerCase();

            const matchesSearch =
                searchableText.includes(search);

            let matchesFilter = true;

            if (filter === "confirmation") {

                matchesFilter = task.needs_confirmation;

            } else if (filter !== "all") {

                matchesFilter = task.status === filter;

            }

            return matchesSearch && matchesFilter;

        });

        if (filteredTasks.length === 0) {

            container.appendChild(
                createAlert(
                    "info",
                    state.tasks.length === 0
                        ? "No deadlines yet."
                        : "No matching deadlines found.",
                    state.tasks.length === 0
                        ? "Add deadlines through Smart Inbox."
                        : "Try another search or filter."
                )
            );

            return;
        }

        filteredTasks.forEach(task => {

            container.appendChild(
                createTaskCard(task)
            );

        });

        refreshIcons();
    }


    // CREATE INDIVIDUAL TASK CARD

    function createTaskCard(task) {

        const card = createElement(
            "article",
            "task-card"
        );

        if (task.status === "completed") {

            card.classList.add("completed");

        } else if (task.needs_confirmation) {

            card.classList.add("uncertain");

        }


        // SUBJECT AND PRIORITY

        const header = createElement(
            "div",
            "task-card-header"
        );

        header.append(

            createBadge(task.subject),

            createBadge(
                task.priority + " priority",
                task.priority
            )

        );

        card.appendChild(header);

        card.append(

            createElement("h3", "", task.task),

            createElement(
                "p",
                "",
                task.description || "No description."
            )

        );


        // DEADLINE AND ESTIMATED HOURS

        const meta = createElement(
            "div",
            "task-meta"
        );

        meta.append(

            createElement(
                "span",
                "",
                `📅 ${formatDate(task.due_date)}`
            ),

            createElement(
                "span",
                "",
                `⏱ ${formatHours(task.estimated_hours)} estimated`
            )

        );

        card.appendChild(meta);


        // STATUS BADGES

        const statusRow = createElement(
            "div",
            "task-card-header"
        );

        statusRow.appendChild(

            createBadge(
                task.status.replaceAll("_", " "),
                task.status
            )

        );

        if (task.needs_confirmation) {

            statusRow.appendChild(

                createBadge(
                    "Needs confirmation",
                    "confirmation"
                )

            );

        }

        if (
            task.due_date &&
            task.due_date < getLocalDate() &&
            task.status !== "completed"
        ) {

            statusRow.appendChild(

                createBadge(
                    "Overdue",
                    "overdue"
                )

            );

        }

        card.appendChild(statusRow);


        // PROGRESS TRACKING

        const estimated = task.estimated_hours;
        const completed = task.completed_hours || 0;

        const progress = task.status === "completed"
            ? 100
            : estimated
                ? Math.min(
                    100,
                    Math.round(completed / estimated * 100)
                )
                : 0;

        const progressLabel = createElement(
            "div",
            "progress-label"
        );

        progressLabel.append(

            createElement(
                "span",
                "",
                `${formatHours(completed)} / ${formatHours(estimated)}`
            ),

            createElement(
                "span",
                "",
                `${progress}%`
            )

        );

        const progressTrack = createElement(
            "div",
            "progress-track"
        );

        const progressFill = createElement(
            "div",
            "progress-fill"
        );

        progressFill.style.width = `${progress}%`;

        progressTrack.appendChild(progressFill);

        card.append(
            progressLabel,
            progressTrack
        );


        // CONFIRMATION WARNING

        if (task.needs_confirmation) {

            card.appendChild(

                createAlert(
                    "warning",
                    "Excluded from workload planning",
                    task.ambiguity_reason ||
                    "Verify the deadline and estimated effort."
                )

            );

        }


        // ORIGINAL SOURCE

        if (task.source_text) {

            card.appendChild(

                createElement(
                    "div",
                    "task-source",
                    `Source (${task.source_type}): ${task.source_text}`
                )

            );

        }


        // ACTION BUTTONS

        const actions = createElement(
            "div",
            "task-actions"
        );

        actions.appendChild(

            createActionButton(
                task.needs_confirmation
                    ? "Review & confirm"
                    : "Edit task",
                "button-outline",
                () => openTaskEditor(task)
            )

        );

        if (task.status !== "completed") {

            actions.appendChild(

                createActionButton(
                    "Mark completed",
                    "button-dark",
                    () => completeTask(task)
                )

            );

        } else {

            actions.appendChild(

                createActionButton(
                    "Reopen",
                    "button-outline",
                    () => reopenTask(task)
                )

            );

        }

        actions.appendChild(

            createActionButton(
                "Delete",
                "button-danger",
                () => deleteTask(task)
            )

        );

        card.appendChild(actions);

        return card;
    }


    // LIVE SEARCH AND FILTERS

    $("task-search").addEventListener(
        "input",
        renderTaskList
    );

    $("task-filter").addEventListener(
        "change",
        renderTaskList
    );


    // OPEN TASK EDITING DIALOG

    function openTaskEditor(task) {

        $("edit-id").value = task.id;

        $("edit-subject").value = task.subject;

        $("edit-task").value = task.task;

        $("edit-description").value =
            task.description || "";

        $("edit-date").value =
            task.due_date || "";

        $("edit-hours").value =
            task.estimated_hours ?? "";

        $("edit-progress").value =
            task.completed_hours || 0;

        $("edit-priority").value =
            task.priority;

        $("edit-status").value =
            task.status;

        $("edit-confirmed").checked =
            !task.needs_confirmation;

        $("task-dialog").showModal();

        refreshIcons();
    }


    // REQUIRE RECONFIRMATION AFTER DATE OR EFFORT EDITS

    ["edit-date", "edit-hours"].forEach(id => {

        $(id).addEventListener("input", () => {

            $("edit-confirmed").checked = false;

        });

    });


    // CLOSE DIALOG

    $("close-dialog").addEventListener("click", () => {

        $("task-dialog").close();

    });


    // COMMON UPDATE FUNCTION

    async function updateTask(taskId, changes) {

        return await apiRequest(
            `/api/tasks/${taskId}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(changes)
            }
        );

    }


    // SAVE EDITED TASK

    $("task-edit-form").addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const taskId = Number($("edit-id").value);

            const subject = $("edit-subject").value.trim();

            const taskName = $("edit-task").value.trim();

            const deadline = $("edit-date").value || null;

            const estimatedHours =
                $("edit-hours").value === ""
                    ? null
                    : Number($("edit-hours").value);

            let completedHours =
                Number($("edit-progress").value || 0);

            const confirmed =
                $("edit-confirmed").checked;

            const status = $("edit-status").value;


            // VALIDATION

            if (!subject || !taskName) {

                showToast(
                    "Subject and task name are required.",
                    "error"
                );

                return;
            }

            if (
                estimatedHours !== null &&
                (
                    !Number.isFinite(estimatedHours) ||
                    estimatedHours < 0.5 ||
                    estimatedHours > 100
                )
            ) {

                showToast(
                    "Estimated hours must be between 0.5 and 100.",
                    "error"
                );

                return;
            }

            if (
                !Number.isFinite(completedHours) ||
                completedHours < 0 ||
                completedHours > 100
            ) {

                showToast(
                    "Enter valid completed hours.",
                    "error"
                );

                return;
            }

            if (
                estimatedHours !== null &&
                completedHours > estimatedHours
            ) {

                showToast(
                    "Completed hours cannot exceed estimated hours.",
                    "error"
                );

                return;
            }

            if (
                confirmed &&
                (!deadline || estimatedHours === null)
            ) {

                showToast(
                    "A deadline and effort estimate are required for confirmation.",
                    "error"
                );

                return;
            }

            if (
                status === "completed" &&
                estimatedHours !== null
            ) {

                completedHours = estimatedHours;

            }


            const changes = {

                subject: subject,

                task: taskName,

                description:
                    $("edit-description").value.trim(),

                due_date: deadline,

                estimated_hours: estimatedHours,

                completed_hours: completedHours,

                priority: $("edit-priority").value,

                status: status,

                needs_confirmation: !confirmed,

                ambiguity_reason: confirmed
                    ? null
                    : "Deadline or effort requires verification."

            };

            const submitButton = event.target.querySelector(
                'button[type="submit"]'
            );

            submitButton.disabled = true;

            try {

                await updateTask(taskId, changes);

                $("task-dialog").close();

                showToast("Deadline updated successfully.");

                await refreshDashboard();

            } catch (error) {

                showToast(error.message, "error");

            } finally {

                submitButton.disabled = false;

            }

        }
    );


    // MARK TASK AS COMPLETED

    async function completeTask(task) {

        const confirmed = window.confirm(
            `Mark "${task.task}" as completed?`
        );

        if (!confirmed) {
            return;
        }

        try {

            await updateTask(task.id, {

                status: "completed",

                completed_hours:
                    task.estimated_hours ??
                    task.completed_hours ??
                    0

            });

            showToast("Task completed! Great work.");

            await refreshDashboard();

        } catch (error) {

            showToast(error.message, "error");

        }
    }


    // REOPEN COMPLETED TASK

    async function reopenTask(task) {

        const confirmed = window.confirm(
            `Reopen "${task.task}" and reset its progress?`
        );

        if (!confirmed) {
            return;
        }

        try {

            await updateTask(task.id, {

                status: "pending",

                completed_hours: 0

            });

            showToast("Task reopened.", "info");

            await refreshDashboard();

        } catch (error) {

            showToast(error.message, "error");

        }
    }


    // DELETE TASK

    async function deleteTask(task) {

        const confirmed = window.confirm(

            `Delete "${task.task}" from ${task.subject}? ` +
            "This action cannot be undone."

        );

        if (!confirmed) {
            return;
        }

        try {

            await apiRequest(
                `/api/tasks/${task.id}`,
                {
                    method: "DELETE"
                }
            );

            showToast("Deadline deleted.");

            await refreshDashboard();

        } catch (error) {

            showToast(error.message, "error");

        }
    }

        // =====================================
    // COLLISION RADAR — WORKLOAD ANALYSIS
    // =====================================

    function renderCollisionRadar() {

        const summary = $("collision-summary");
        const chart = $("collision-chart");
        const results = $("collision-results");

        summary.replaceChildren();
        chart.replaceChildren();
        results.replaceChildren();

        const analysis = state.collisions;

        if (!analysis) {

            summary.appendChild(
                createAlert(
                    "info",
                    "Analysis not available",
                    "Click Run analysis to evaluate your workload."
                )
            );

            return;
        }

        const checkpoints = analysis.checkpoints || [];

        const maximumDeficit = Math.max(
            0,
            ...checkpoints.map(item => item.deficit_hours)
        );


        // =====================================
        // 1. ANALYSIS SUMMARY
        // =====================================

        if (analysis.collision_detected) {

            summary.appendChild(
                createAlert(
                    "danger",
                    "Academic overload detected!",
                    `${analysis.collision_count} overloaded deadline checkpoint(s). ` +
                    `You need up to ${formatHours(maximumDeficit)} ` +
                    `of additional study capacity.`
                )
            );

        } else if (checkpoints.length === 0) {

            summary.appendChild(
                createAlert(
                    "info",
                    "No confirmed upcoming deadlines",
                    "Add or confirm tasks to generate workload analysis."
                )
            );

        } else {

            summary.appendChild(
                createAlert(
                    "success",
                    "Your workload is manageable!",
                    `Your confirmed upcoming deadlines fit within ` +
                    `${state.dailyHours} hours of study per day.`
                )
            );

        }

        const excluded =
            analysis.excluded_task_ids?.length || 0;

        const overdue =
            analysis.overdue_task_ids?.length || 0;

        if (excluded > 0) {

            summary.appendChild(
                createAlert(
                    "warning",
                    `${excluded} task(s) excluded`,
                    "These tasks require a confirmed deadline or effort estimate."
                )
            );

        }

        if (overdue > 0) {

            summary.appendChild(
                createAlert(
                    "danger",
                    `${overdue} overdue task(s)`,
                    "These tasks fall before your planning date. Review them separately."
                )
            );

        }

        if (checkpoints.length === 0) {
            return;
        }


        // =====================================
        // 2. SUMMARY METRIC CARDS
        // =====================================

        const metrics = createElement(
            "div",
            "radar-metrics"
        );

        const metricData = [

            {
                label: "Remaining workload",
                value: formatHours(
                    analysis.total_remaining_hours
                ),
                color: "radar-lavender"
            },

            {
                label: "Overloaded checkpoints",
                value: analysis.collision_count,
                color: "radar-peach"
            },

            {
                label: "Maximum shortage",
                value: formatHours(maximumDeficit),
                color: "radar-yellow"
            },

            {
                label: "Daily study capacity",
                value: `${state.dailyHours}h/day`,
                color: "radar-green"
            }

        ];

        metricData.forEach(item => {

            const metric = createElement(
                "div",
                `radar-metric ${item.color}`
            );

            metric.append(

                createElement("span", "", item.label),

                createElement("strong", "", item.value)

            );

            metrics.appendChild(metric);

        });

        summary.appendChild(metrics);


        // =====================================
        // 3. WORKLOAD COMPARISON CHART
        // =====================================

        chart.append(

            createElement(
                "h3",
                "",
                "Workload vs. available capacity"
            ),

            createElement(
                "p",
                "radar-chart-description",
                "Cumulative study hours required by each deadline."
            )

        );

        const legend = createElement(
            "div",
            "radar-legend"
        );

        [
            ["Required workload", "legend-required"],
            ["Available capacity", "legend-available"],
            ["Overloaded workload", "legend-overload"]

        ].forEach(([label, className]) => {

            const item = createElement(
                "span",
                "radar-legend-item"
            );

            item.append(

                createElement("span", className),

                document.createTextNode(label)

            );

            legend.appendChild(item);

        });

        chart.appendChild(legend);


        // COMMON SCALE FOR ALL BARS

        const maxHours = Math.max(

            1,

            ...checkpoints.flatMap(item => [

                item.required_hours,
                item.available_hours

            ])

        );


        checkpoints.forEach(checkpoint => {

            const group = createElement(
                "div",
                "radar-chart-group"
            );

            const heading = createElement(
                "div",
                "radar-chart-heading"
            );

            heading.append(

                createElement(
                    "strong",
                    "",
                    formatDate(checkpoint.deadline)
                ),

                createBadge(
                    checkpoint.risk,
                    checkpoint.risk
                )

            );

            group.appendChild(heading);


            const bars = [

                {
                    label: "Required",
                    hours: checkpoint.required_hours,
                    className:
                        checkpoint.deficit_hours > 0
                            ? "radar-bar-overload"
                            : "radar-bar-required"
                },

                {
                    label: "Available",
                    hours: checkpoint.available_hours,
                    className: "radar-bar-available"
                }

            ];


            bars.forEach(item => {

                const row = createElement(
                    "div",
                    "radar-bar-row"
                );

                const track = createElement(
                    "div",
                    "radar-bar-track"
                );

                const fill = createElement(
                    "div",
                    `radar-bar-fill ${item.className}`
                );

                fill.style.width =
                    `${item.hours / maxHours * 100}%`;

                track.appendChild(fill);

                row.append(

                    createElement(
                        "span",
                        "radar-bar-label",
                        item.label
                    ),

                    track,

                    createElement(
                        "strong",
                        "radar-bar-value",
                        formatHours(item.hours)
                    )

                );

                group.appendChild(row);

            });

            chart.appendChild(group);

        });


        // =====================================
        // 4. DEADLINE-WISE RISK BREAKDOWN
        // =====================================

        results.appendChild(
            createElement(
                "h3",
                "",
                "Deadline-wise risk breakdown"
            )
        );


        checkpoints.forEach(checkpoint => {

            const card = createElement(
                "article",
                `radar-checkpoint risk-${checkpoint.risk}`
            );

            const header = createElement(
                "div",
                "task-card-header"
            );

            header.append(

                createElement(
                    "h3",
                    "",
                    formatDate(checkpoint.deadline)
                ),

                createBadge(
                    checkpoint.risk + " risk",
                    checkpoint.risk
                )

            );

            card.appendChild(header);


            const utilization =
                checkpoint.utilization === null
                    ? "No available capacity"
                    : `${Number(checkpoint.utilization.toFixed(1))}%`;


            const details = [

                [
                    "Cumulative workload",
                    formatHours(checkpoint.required_hours)
                ],

                [
                    "Available study capacity",
                    formatHours(checkpoint.available_hours)
                ],

                [
                    "Capacity utilization",
                    utilization
                ],

                [
                    "Workload shortage",
                    formatHours(checkpoint.deficit_hours)
                ]

            ];


            details.forEach(([label, value]) => {

                const row = createElement(
                    "div",
                    "metric-row"
                );

                row.append(

                    createElement("span", "", label),

                    createElement("strong", "", value)

                );

                card.appendChild(row);

            });


            // TASKS CONTRIBUTING TO THIS CHECKPOINT

            const contributingTasks = state.tasks.filter(
                task => checkpoint.task_ids.includes(task.id)
            );

            if (contributingTasks.length > 0) {

                card.appendChild(
                    createElement(
                        "h4",
                        "radar-task-heading",
                        "Contributing deadlines"
                    )
                );

                contributingTasks.forEach(task => {

                    const remaining = Math.max(

                        0,

                        (task.estimated_hours || 0) -
                        (task.completed_hours || 0)

                    );

                    const row = createElement(
                        "div",
                        "radar-task-row"
                    );

                    row.append(

                        createElement(
                            "span",
                            "",
                            `${task.subject} — ${task.task}`
                        ),

                        createElement(
                            "strong",
                            "",
                            formatHours(remaining)
                        )

                    );

                    card.appendChild(row);

                });

            }


            // RECOMMENDED NEXT ACTION

            if (checkpoint.deficit_hours > 0) {

                card.appendChild(
                    createAlert(
                        "danger",
                        "Action recommended",
                        `Recover at least ${
                            formatHours(checkpoint.deficit_hours)
                        } of study capacity before this deadline.`
                    )
                );

            }

            results.appendChild(card);

        });


        // =====================================
        // 5. NEXT ACTION BUTTONS
        // =====================================

        const actions = createElement(
            "div",
            "task-actions"
        );

        actions.append(

            createActionButton(
                "View Recovery Plan",
                "button-dark",
                () => showPage("recovery")
            ),

            createActionButton(
                "Try What-If Simulator",
                "button-outline",
                () => showPage("simulator")
            )

        );

        results.appendChild(actions);

        refreshIcons();

    }


    // =====================================
    // RUN COLLISION ANALYSIS BUTTON
    // =====================================

    $("analyze-collisions").addEventListener(
        "click",
        async () => {

            const button = $("analyze-collisions");

            button.disabled = true;

            try {

                await refreshDashboard();

            } finally {

                button.disabled = false;

            }

        }
    );

        // =====================================
    // WHAT-IF SIMULATOR
    // =====================================

    function populateSimulatorTasks() {

        const select = $("sim-task");
        const previousValue = select.value;

        select.replaceChildren();

        const defaultOption = createElement(
            "option",
            "",
            "No task changes"
        );

        defaultOption.value = "";
        select.appendChild(defaultOption);

        const eligibleTasks = state.tasks.filter(task =>
            task.status !== "completed" &&
            !task.needs_confirmation &&
            task.due_date &&
            task.due_date >= state.startDate &&
            task.estimated_hours !== null
        );

        eligibleTasks.forEach(task => {

            const option = createElement(
                "option",
                "",
                `${task.subject} — ${task.task}`
            );

            option.value = task.id;

            select.appendChild(option);

        });

        if (eligibleTasks.some(
            task => String(task.id) === previousValue
        )) {

            select.value = previousValue;

        } else {

            select.value = "";

        }

        updateSimulatorFields();
    }


    // ENABLE OR DISABLE TASK MODIFICATION FIELDS

    function updateSimulatorFields() {

        const taskId = Number($("sim-task").value);

        const task = state.tasks.find(
            item => item.id === taskId
        );

        const fields = [
            "sim-date",
            "sim-effort",
            "sim-progress"
        ];

        fields.forEach(id => {

            $(id).disabled = !task;

            if (!task) {
                $(id).value = "";
            }

        });

        $("sim-date").min = state.startDate;

        $("sim-effort").placeholder = task
            ? `Current: ${task.estimated_hours}h`
            : "Leave unchanged";

        $("sim-progress").placeholder = task
            ? `Current: ${task.completed_hours || 0}h`
            : "Leave unchanged";
    }


    $("sim-task").addEventListener("change", () => {

        $("sim-date").value = "";
        $("sim-effort").value = "";
        $("sim-progress").value = "";

        updateSimulatorFields();

    });


    // =====================================
    // RUN SIMULATION
    // =====================================

    async function runSimulation() {

        const button = $("run-simulation");
        const container = $("simulation-results");

        const simulatedHours = Number(
            $("sim-hours").value
        );

        if (
            $("sim-hours").value === "" ||
            !Number.isFinite(simulatedHours) ||
            simulatedHours < 0 ||
            simulatedHours > 24
        ) {

            showToast(
                "Study hours must be between 0 and 24.",
                "error"
            );

            return;
        }

        const taskChanges = [];

        const taskId = Number($("sim-task").value);

        if (taskId) {

            const task = state.tasks.find(
                item => item.id === taskId
            );

            if (!task) {

                showToast(
                    "Selected task is no longer available.",
                    "error"
                );

                return;
            }

            const change = {
                task_id: taskId
            };

            const newDate = $("sim-date").value;

            const effortValue = $("sim-effort").value;

            const progressValue = $("sim-progress").value;

            if (newDate) {

                if (newDate < state.startDate) {

                    showToast(
                        "Hypothetical deadline cannot precede the planning date.",
                        "error"
                    );

                    return;
                }

                change.due_date = newDate;
            }

            if (effortValue !== "") {

                const effort = Number(effortValue);

                if (
                    !Number.isFinite(effort) ||
                    effort < 0.5 ||
                    effort > 100
                ) {

                    showToast(
                        "Estimated effort must be between 0.5 and 100 hours.",
                        "error"
                    );

                    return;
                }

                change.estimated_hours = effort;
            }

            if (progressValue !== "") {

                const progress = Number(progressValue);

                if (
                    !Number.isFinite(progress) ||
                    progress < 0 ||
                    progress > 100
                ) {

                    showToast(
                        "Enter valid completed hours.",
                        "error"
                    );

                    return;
                }

                change.completed_hours = progress;
            }

            const finalEffort =
                change.estimated_hours ??
                task.estimated_hours;

            const finalProgress =
                change.completed_hours ??
                task.completed_hours ??
                0;

            if (finalProgress > finalEffort) {

                showToast(
                    "Completed hours cannot exceed estimated hours.",
                    "error"
                );

                return;
            }

            if (Object.keys(change).length > 1) {

                taskChanges.push(change);

            }
        }

        button.disabled = true;

        container.className = "result-area";

        showLoading(
            container,
            "Simulating your academic workload..."
        );

        try {

            const data = await apiRequest(
                "/api/simulate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        baseline_hours: state.dailyHours,

                        simulated_hours: simulatedHours,

                        start_date: state.startDate,

                        task_changes: taskChanges

                    })
                }
            );

            renderSimulationResults(data);

            showToast("Simulation completed.");

        } catch (error) {

            container.replaceChildren(

                createAlert(
                    "danger",
                    "Simulation failed",
                    error.message
                )

            );

            showToast(error.message, "error");

        } finally {

            button.disabled = false;

            refreshIcons();
        }
    }


    // =====================================
    // RENDER SIMULATION RESULTS
    // =====================================

    function renderSimulationResults(data) {

        const container = $("simulation-results");

        const comparison = data.comparison;

        container.replaceChildren();

        container.className = "result-area";


        // SCENARIO OUTCOME

        const outcome = comparison.outcome;

        const outcomeCard = createElement(
            "div",
            `simulation-outcome outcome-${outcome}`
        );

        const outcomeTitles = {

            improved: "Your scenario improves the plan!",

            worsened: "This scenario increases workload risk.",

            unchanged: "No significant improvement."

        };

        outcomeCard.append(

            createElement(
                "span",
                "simulation-kicker",
                "SCENARIO OUTCOME"
            ),

            createElement(
                "h3",
                "",
                outcomeTitles[outcome] ||
                "Simulation complete"
            ),

            createElement(
                "p",
                "",
                outcome === "improved"
                    ? "Your hypothetical changes reduce the workload shortage."
                    : outcome === "worsened"
                    ? "Consider increasing available time or adjusting deadlines."
                    : "The simulated workload shortage remains unchanged."
            )

        );

        container.appendChild(outcomeCard);


        // RECOVERED HOURS

        const recovered = comparison.hours_recovered;

        const recoveryCard = createElement(
            "div",
            "simulation-recovered"
        );

        recoveryCard.append(

            createElement(
                "span",
                "",
                recovered >= 0
                    ? "Workload shortage recovered"
                    : "Additional workload shortage"
            ),

            createElement(
                "strong",
                "",
                formatHours(Math.abs(recovered))
            )

        );

        container.appendChild(recoveryCard);


        // BEFORE VS AFTER TABLE

        const table = createElement(
            "div",
            "simulation-table"
        );

        const header = createElement(
            "div",
            "simulation-table-row simulation-table-header"
        );

        header.append(

            createElement("span", "", "Metric"),

            createElement("strong", "", "Before"),

            createElement("strong", "", "After")

        );

        table.appendChild(header);


        const metrics = [

            {
                label: "Study hours/day",
                before: comparison.baseline_daily_hours,
                after: comparison.simulated_daily_hours,
                hours: true,
                direction: "neutral"
            },

            {
                label: "Workload shortage",
                before: comparison.baseline_deficit_hours,
                after: comparison.simulated_deficit_hours,
                hours: true,
                direction: "lower"
            },

            {
                label: "Collisions",
                before: comparison.baseline_collisions,
                after: comparison.simulated_collisions,
                direction: "lower"
            },

            {
                label: "Tasks at risk",
                before: comparison.baseline_tasks_at_risk,
                after: comparison.simulated_tasks_at_risk,
                direction: "lower"
            }

        ];

        metrics.forEach(metric => {

            const row = createElement(
                "div",
                "simulation-table-row"
            );

            let resultClass = "";

            if (metric.direction === "lower") {

                if (metric.after < metric.before) {

                    resultClass = "simulation-improved";

                } else if (metric.after > metric.before) {

                    resultClass = "simulation-worsened";

                }

            }

            row.append(

                createElement(
                    "span",
                    "",
                    metric.label
                ),

                createElement(
                    "strong",
                    "",
                    metric.hours
                        ? formatHours(metric.before)
                        : metric.before
                ),

                createElement(
                    "strong",
                    resultClass,
                    metric.hours
                        ? formatHours(metric.after)
                        : metric.after
                )

            );

            table.appendChild(row);

        });


        // FEASIBILITY ROW

        const feasibility = createElement(
            "div",
            "simulation-table-row"
        );

        feasibility.append(

            createElement("span", "", "Feasibility"),

            createBadge(
                comparison.baseline_feasible
                    ? "Feasible"
                    : "At risk",

                comparison.baseline_feasible
                    ? "success"
                    : "critical"
            ),

            createBadge(
                comparison.simulated_feasible
                    ? "Feasible"
                    : "At risk",

                comparison.simulated_feasible
                    ? "success"
                    : "critical"
            )

        );

        table.appendChild(feasibility);

        container.appendChild(table);


        // VISUAL WORKLOAD SHORTAGE COMPARISON

        const chart = createElement(
            "div",
            "simulation-chart"
        );

        chart.appendChild(

            createElement(
                "h3",
                "",
                "Workload shortage comparison"
            )

        );

        const maxDeficit = Math.max(

            1,

            comparison.baseline_deficit_hours,

            comparison.simulated_deficit_hours

        );

        [

            {
                label: "Before",
                value: comparison.baseline_deficit_hours,
                color: "simulation-bar-before"
            },

            {
                label: "After",
                value: comparison.simulated_deficit_hours,
                color: "simulation-bar-after"
            }

        ].forEach(item => {

            const row = createElement(
                "div",
                "simulation-chart-row"
            );

            const track = createElement(
                "div",
                "simulation-bar-track"
            );

            const fill = createElement(
                "div",
                `simulation-bar-fill ${item.color}`
            );

            fill.style.width =
                `${item.value / maxDeficit * 100}%`;

            track.appendChild(fill);

            row.append(

                createElement("span", "", item.label),

                track,

                createElement(
                    "strong",
                    "",
                    formatHours(item.value)
                )

            );

            chart.appendChild(row);

        });

        container.appendChild(chart);


        // TASKS STILL AT RISK

        const atRisk =
            data.simulation.schedule_analysis.tasks_at_risk || [];

        if (atRisk.length > 0) {

            container.appendChild(

                createElement(
                    "h3",
                    "simulation-risk-heading",
                    "Remaining tasks at risk"
                )

            );

            atRisk.forEach(task => {

                const row = createElement(
                    "div",
                    "simulation-risk-row"
                );

                row.append(

                    createElement("span", "", task.task),

                    createElement(
                        "strong",
                        "",
                        `${formatHours(task.unscheduled_hours)} unscheduled`
                    )

                );

                container.appendChild(row);

            });

        }


        // EXCLUDED TASKS

        const excluded =
            data.simulation.schedule_analysis.excluded_task_ids || [];

        const overdue =
            data.simulation.schedule_analysis.overdue_task_ids || [];

        if (excluded.length || overdue.length) {

            container.appendChild(

                createAlert(
                    "warning",
                    "Planning limitations",
                    `${excluded.length} unconfirmed or incomplete task(s) and ` +
                    `${overdue.length} task(s) before the planning date are excluded.`
                )

            );

        }


        // DATABASE SAFETY MESSAGE

        if (data.database_modified === false) {

            container.appendChild(

                createAlert(
                    "success",
                    "Your original plan is safe.",
                    "This was a hypothetical simulation. No saved deadlines or progress were modified."
                )

            );

        }

        refreshIcons();
    }


    // SIMULATION BUTTON

    $("run-simulation").addEventListener(
        "click",
        runSimulation
    );

        // =====================================
    // SMART EXTENSION ASSISTANT
    // =====================================

    function populateExtensionTasks() {

        const select = $("extension-task");
        const previousValue = select.value;

        select.replaceChildren();

        const defaultOption = createElement(
            "option",
            "",
            "Choose a deadline"
        );

        defaultOption.value = "";
        select.appendChild(defaultOption);

        const eligibleTasks = state.tasks.filter(task =>
            task.status !== "completed" &&
            !task.needs_confirmation &&
            task.due_date &&
            task.due_date >= state.startDate &&
            task.estimated_hours !== null &&
            task.estimated_hours > (task.completed_hours || 0)
        );

        eligibleTasks.forEach(task => {

            const option = createElement(
                "option",
                "",
                `${task.subject} — ${task.task}`
            );

            option.value = task.id;

            select.appendChild(option);

        });

        if (eligibleTasks.some(
            task => String(task.id) === previousValue
        )) {

            select.value = previousValue;

        } else {

            select.value = "";

        }
    }


    // =====================================
    // REQUEST EXTENSION RECOMMENDATION
    // =====================================

    async function runExtensionAssistant() {

        const taskId = Number($("extension-task").value);

        const maxDays = Number($("extension-limit").value);

        const generateEmail = $("generate-email").checked;

        const button = $("recommend-extension");

        const container = $("extension-results");

        const emailDraft = $("email-draft");

        if (!taskId) {

            showToast(
                "Please select a task first.",
                "error"
            );

            return;
        }

        if (
            !Number.isInteger(maxDays) ||
            maxDays < 1 ||
            maxDays > 30
        ) {

            showToast(
                "Maximum extension must be between 1 and 30 days.",
                "error"
            );

            return;
        }

        button.disabled = true;

        emailDraft.value = "";

        $("copy-email").disabled = true;

        showLoading(
            container,
            generateEmail
                ? "Evaluating extension scenarios and preparing your email..."
                : "Evaluating extension scenarios..."
        );

        try {

            const data = await apiRequest(
                "/api/extension",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        task_id: taskId,

                        daily_hours: state.dailyHours,

                        start_date: state.startDate,

                        max_extension_days: maxDays,

                        generate_email: generateEmail

                    })
                }
            );

            renderExtensionResults(data);

            if (data.email_draft) {

                emailDraft.value = data.email_draft;

                $("copy-email").disabled = false;

            }

            showToast("Extension analysis completed.");

        } catch (error) {

            container.replaceChildren(

                createAlert(
                    "danger",
                    "Extension analysis failed",
                    error.message
                )

            );

            showToast(error.message, "error");

        } finally {

            button.disabled = false;

            refreshIcons();

        }
    }


    // =====================================
    // RENDER EXTENSION RESULTS
    // =====================================

    function renderExtensionResults(data) {

        const container = $("extension-results");

        const recommendation = data.recommendation;

        container.replaceChildren();


        // EXTENSION NOT REQUIRED

        if (recommendation.status === "not_needed") {

            const card = createElement(
                "div",
                "extension-outcome extension-success"
            );

            card.append(

                createElement(
                    "span",
                    "extension-kicker",
                    "ANALYSIS COMPLETE"
                ),

                createElement(
                    "h3",
                    "",
                    "No extension needed!"
                ),

                createElement(
                    "p",
                    "",
                    "Your confirmed workload fits within your current study capacity."
                )

            );

            container.appendChild(card);

            container.appendChild(

                createAlert(
                    "success",
                    "Keep your original deadline",
                    "An extension is not necessary under your current planning assumptions."
                )

            );

        }


        // EXTENSION RECOMMENDED

        else if (recommendation.status === "recommended") {

            const card = createElement(
                "div",
                "extension-outcome extension-success"
            );

            const days = recommendation.extension_days;

            card.append(

                createElement(
                    "span",
                    "extension-kicker",
                    "MINIMUM FEASIBLE EXTENSION"
                ),

                createElement(
                    "strong",
                    "extension-big-number",
                    `${days} ${days === 1 ? "day" : "days"}`
                ),

                createElement(
                    "p",
                    "",
                    "The shortest tested extension that resolves the confirmed scheduling shortage."
                )

            );

            container.appendChild(card);


            // DEADLINE COMPARISON

            const dates = createElement(
                "div",
                "extension-date-grid"
            );

            const original = createElement(
                "div",
                "extension-date-card extension-original"
            );

            original.append(

                createElement(
                    "span",
                    "",
                    "Original deadline"
                ),

                createElement(
                    "strong",
                    "",
                    recommendation.original_deadline
                )

            );

            const proposed = createElement(
                "div",
                "extension-date-card extension-proposed"
            );

            proposed.append(

                createElement(
                    "span",
                    "",
                    "Recommended deadline"
                ),

                createElement(
                    "strong",
                    "",
                    recommendation.recommended_deadline
                )

            );

            dates.append(original, proposed);

            container.appendChild(dates);


            // RECOVERED WORKLOAD

            const recovered = createElement(
                "div",
                "extension-recovered"
            );

            recovered.append(

                createElement(
                    "span",
                    "",
                    "Workload shortage resolved"
                ),

                createElement(
                    "strong",
                    "",
                    formatHours(recommendation.hours_recovered)
                )

            );

            container.appendChild(recovered);

        }


        // NO FEASIBLE EXTENSION

        else {

            const card = createElement(
                "div",
                "extension-outcome extension-warning"
            );

            card.append(

                createElement(
                    "span",
                    "extension-kicker",
                    "ADDITIONAL ACTION REQUIRED"
                ),

                createElement(
                    "h3",
                    "",
                    "One extension is not enough."
                ),

                createElement(
                    "p",
                    "",
                    "No tested extension for this task resolves the entire confirmed workload shortage."
                )

            );

            container.appendChild(card);

            container.appendChild(

                createAlert(
                    "warning",
                    "Explore other solutions",
                    "Try adjusting multiple deadlines or increasing study availability using the What-If Simulator."
                )

            );

        }


        // TESTED EXTENSION SCENARIOS

        const scenarios = recommendation.scenarios || [];

        if (scenarios.length > 0) {

            const scenarioPanel = createElement(
                "div",
                "extension-scenarios"
            );

            scenarioPanel.appendChild(

                createElement(
                    "h3",
                    "",
                    "Tested extension scenarios"
                )

            );

            scenarios.forEach(scenario => {

                const row = createElement(
                    "div",
                    scenario.feasible
                        ? "extension-scenario-row scenario-feasible"
                        : "extension-scenario-row"
                );

                const details = createElement(
                    "div",
                    ""
                );

                details.append(

                    createElement(
                        "strong",
                        "",
                        `+${scenario.extension_days} day(s)`
                    ),

                    createElement(
                        "p",
                        "",
                        scenario.new_deadline
                    )

                );

                const result = createElement(
                    "div",
                    "extension-scenario-result"
                );

                result.append(

                    createElement(
                        "strong",
                        "",
                        formatHours(
                            scenario.remaining_deficit_hours
                        )
                    ),

                    createBadge(
                        scenario.feasible
                            ? "Feasible"
                            : "At risk",

                        scenario.feasible
                            ? "success"
                            : "critical"
                    )

                );

                row.append(details, result);

                scenarioPanel.appendChild(row);

            });

            container.appendChild(scenarioPanel);

        }


        // PLANNING LIMITATIONS

        const excluded =
            recommendation.excluded_task_ids || [];

        const overdue =
            recommendation.overdue_task_ids || [];

        if (excluded.length || overdue.length) {

            container.appendChild(

                createAlert(
                    "warning",
                    "Planning limitations",
                    `${excluded.length} unconfirmed or incomplete task(s) and ` +
                    `${overdue.length} overdue task(s) are excluded.`
                )

            );

        }


        // EMAIL GENERATION FAILURE

        if (data.email_error) {

            container.appendChild(

                createAlert(
                    "warning",
                    "Email draft unavailable",
                    "The extension recommendation is valid, but the AI email could not be generated. Please try again."
                )

            );

        }


        // DATABASE SAFETY

        container.appendChild(

            createAlert(
                "success",
                "You remain in control.",
                "No deadline has been changed and no email has been sent. Review the recommendation before requesting approval."
            )

        );

        refreshIcons();

    }


    // =====================================
    // COPY EMAIL
    // =====================================

    $("copy-email").addEventListener("click", async () => {

        const text = $("email-draft").value.trim();

        if (!text) {

            showToast("No email draft to copy.", "error");

            return;

        }

        try {

            await navigator.clipboard.writeText(text);

            showToast("Email copied to clipboard!");

        } catch (error) {

            $("email-draft").focus();

            $("email-draft").select();

            showToast(
                "Press Ctrl + C to copy the selected email."
            );

        }

    });


    $("email-draft").addEventListener("input", () => {

        $("copy-email").disabled =
            !$("email-draft").value.trim();

    });


    $("extension-task").addEventListener("change", () => {

        $("extension-results").replaceChildren();

        $("email-draft").value = "";

        $("copy-email").disabled = true;

    });


    $("recommend-extension").addEventListener(
        "click",
        runExtensionAssistant
    );

    // =====================================
    // 10. APPLICATION INITIALIZATION
    // =====================================

    async function initialize() {

        refreshIcons();

        $("today-date").textContent =
            new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric"
            });

        state.startDate = getLocalDate();

        $("start-date").value = state.startDate;
        $("daily-hours").value = state.dailyHours;

        showPage(
            window.location.hash.slice(1) || "overview"
        );

        await Promise.all([
            checkHealth(),
            refreshDashboard()
        ]);
    }

    initialize();

});

// ==========================================
// RECOVERY PLAN
// ==========================================

async function generateRecoveryPlan() {
    const summary = document.getElementById("schedule-summary");
    const results = document.getElementById("schedule-results");
    const risk = document.getElementById("schedule-risk");
    const button = document.getElementById("generate-schedule");

    const dailyHours = Number(
        document.getElementById("daily-hours").value
    );

    if (!Number.isFinite(dailyHours) || dailyHours < 0 || dailyHours > 24) {
        summary.textContent = "Enter valid daily study hours.";
        return;
    }

    const escapeText = (value) => String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );

    const formatDate = (value) =>
        new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

    button.disabled = true;
    summary.textContent = "Creating your personalized study plan...";
    results.innerHTML = "";
    risk.innerHTML = "";

    try {
        const params = new URLSearchParams({
            daily_hours: dailyHours
        });

        const startDate = document.getElementById("start-date");

        if (startDate && startDate.value) {
            params.set("start_date", startDate.value);
        }

        const response = await fetch(`/api/schedule?${params}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Unable to generate schedule.");
        }

        summary.innerHTML = `
            <div class="recovery-alert ${data.feasible ? "recovery-success" : "recovery-warning"}">
                <strong>
                    ${data.feasible
                        ? "Your recovery plan is achievable!"
                        : "Your workload needs additional time."}
                </strong>

                <p>
                    ${data.feasible
                        ? "All confirmed upcoming tasks fit within your available study capacity."
                        : `${data.total_unscheduled_hours} hours could not be allocated before their deadlines.`}
                </p>
            </div>

            <div class="recovery-stats">

                <div class="recovery-stat" style="background:#d9c8f5">
                    <span>Required workload</span>
                    <strong>${data.total_required_hours}h</strong>
                </div>

                <div class="recovery-stat" style="background:#b9d9ae">
                    <span>Successfully scheduled</span>
                    <strong>${data.total_scheduled_hours}h</strong>
                </div>

                <div class="recovery-stat" style="background:#f7d2c4">
                    <span>Unscheduled workload</span>
                    <strong>${data.total_unscheduled_hours}h</strong>
                </div>

                <div class="recovery-stat" style="background:#f5dfa0">
                    <span>Tasks at risk</span>
                    <strong>${data.tasks_at_risk.length}</strong>
                </div>

            </div>
        `;

        if (data.excluded_task_ids.length > 0) {
            summary.innerHTML += `
                <div class="recovery-alert recovery-warning">
                    <strong>
                        ${data.excluded_task_ids.length} task(s) excluded
                    </strong>
                    <p>Confirm their deadlines and effort estimates to include them.</p>
                </div>
            `;
        }

        if (data.overdue_task_ids.length > 0) {
            summary.innerHTML += `
                <div class="recovery-alert recovery-warning">
                    <strong>
                        ${data.overdue_task_ids.length} overdue task(s)
                    </strong>
                    <p>Review these separately in your Deadline Hub.</p>
                </div>
            `;
        }

        results.innerHTML = `
            <h2 class="recovery-section-title">Your day-by-day plan</h2>
        `;

        if (data.schedule.length === 0) {
            results.innerHTML += `
                <div class="recovery-alert">
                    No study sessions could be scheduled.
                </div>
            `;
        }

        data.schedule.forEach(day => {

            const utilization = dailyHours > 0
                ? Math.min(100, (day.allocated_hours / dailyHours) * 100)
                : 0;

            results.innerHTML += `
                <div class="recovery-day">

                    <div class="recovery-day-header">
                        <h3>${formatDate(day.date)}</h3>
                        <span>${day.allocated_hours}h / ${dailyHours}h</span>
                    </div>

                    <div class="recovery-progress">
                        <div style="width:${utilization}%"></div>
                    </div>

                    <p class="recovery-capacity">
                        ${day.remaining_capacity}h free capacity
                    </p>

                    ${day.sessions.map(session => `
                        <div class="recovery-session">

                            <div>
                                <span class="recovery-subject">
                                    ${escapeText(session.subject)}
                                </span>

                                <h4>${escapeText(session.task)}</h4>

                                <small>
                                    ${escapeText(session.priority)} priority
                                </small>
                            </div>

                            <strong class="recovery-duration">
                                ${session.hours}h
                            </strong>

                        </div>
                    `).join("")}

                </div>
            `;
        });

        if (data.tasks_at_risk.length > 0) {
            risk.innerHTML = `
                <h2 class="recovery-section-title">
                    Deadlines requiring attention
                </h2>

                ${data.tasks_at_risk.map(task => `
                    <div class="recovery-risk-card">

                        <div>
                            <h3>${escapeText(task.task)}</h3>
                            <p>Deadline: ${formatDate(task.deadline)}</p>
                        </div>

                        <strong>
                            ${task.unscheduled_hours}h unscheduled
                        </strong>

                    </div>
                `).join("")}

                <div class="recovery-alert recovery-warning">
                    <strong>What can you do next?</strong>
                    <p>
                        Simulate additional study hours or explore
                        a possible deadline extension.
                    </p>
                </div>

                <div class="recovery-actions">

                    <a href="#simulator" class="button button-dark">
                        Try What-If Simulator
                    </a>

                    <a href="#extension" class="button button-outline">
                        Extension Assistant
                    </a>

                </div>
            `;
        } else {
            risk.innerHTML = `
                <div class="recovery-alert recovery-success">
                    <strong>No confirmed upcoming deadlines at risk!</strong>
                    <p>Follow your study plan and update your progress regularly.</p>
                </div>
            `;
        }

    } catch (error) {
        summary.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

document.getElementById("generate-schedule")
    .addEventListener("click", generateRecoveryPlan);