document.addEventListener('DOMContentLoaded', () => {
    
    const heatmapContainer = document.getElementById('heatmapContainer');
    if (!heatmapContainer) return;

    let currentDataMap = {};

    window.loadHeatmap = (year = null) => {
        let url = '/analytics/data/';
        if (year) url += `?year=${year}`;
        
        fetch(url, {
            headers: {
                'X-CSRFToken': typeof csrfToken !== 'undefined' ? csrfToken : '',
            }
        })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                renderHeatmap(res.data, res.selected_year);
                renderYearSelector(res.years, res.selected_year);
            }
        });
    };

    const renderYearSelector = (years, selectedYear) => {
        const yearSelector = document.getElementById('yearSelector');
        if (!yearSelector) return;
        yearSelector.innerHTML = '';
        
        years.forEach(y => {
            const btn = document.createElement('button');
            btn.className = `list-group-item list-group-item-action border-0 rounded my-1 text-center py-2 ${y === selectedYear ? 'active bg-primary text-white' : 'bg-transparent'}`;
            btn.innerText = y;
            btn.onclick = () => loadHeatmap(y);
            yearSelector.appendChild(btn);
        });
    };

    const renderHeatmap = (data, selectedYear) => {
        const heatmapMonths = document.getElementById('heatmapMonths');
        
        currentDataMap = {};
        data.forEach(d => {
            currentDataMap[d.date] = d;
        });

        // Generate columns
        heatmapContainer.innerHTML = '';
        if (heatmapMonths) heatmapMonths.innerHTML = '';
        
        const startDate = new Date(selectedYear, 0, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        
        const endDate = new Date(selectedYear, 11, 31);
        
        let currentDay = new Date(startDate);
        let lastMonth = -1;
        let col = 0;
        
        while (currentDay <= endDate || currentDay.getDay() !== 0) {
            if (currentDay.getDay() === 0) {
                const colDiv = document.createElement('div');
                colDiv.className = 'heatmap-col';
                
                if (currentDay.getMonth() !== lastMonth && currentDay.getFullYear() === selectedYear) {
                    if (heatmapMonths) {
                        const monthLabel = document.createElement('span');
                        monthLabel.className = 'position-absolute';
                        monthLabel.style.left = `${col * 18}px`;
                        monthLabel.innerText = currentDay.toLocaleString('default', { month: 'short' });
                        heatmapMonths.appendChild(monthLabel);
                    }
                    lastMonth = currentDay.getMonth();
                }
                
                for (let row = 0; row < 7; row++) {
                    const cell = document.createElement('div');
                    cell.className = 'heatmap-cell';
                    
                    const dateStr = currentDay.toLocaleDateString('en-CA');
                    const dayData = currentDataMap[dateStr];
                    
                    // Create a normalized today date for comparison
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);
                    const cellDate = new Date(currentDay);
                    cellDate.setHours(0, 0, 0, 0);
                    
                    if (currentDay.getFullYear() !== selectedYear) {
                        cell.style.visibility = 'hidden';
                    } else {
                        if (dayData && dayData.hours > 0) {
                            cell.classList.add('level-4');
                        }
                        
                        if (cellDate > todayDate) {
                            // Future dates: not clickable
                            cell.style.cursor = 'default';
                            cell.title = dateStr;
                        } else {
                            // Past/Today dates: clickable
                            cell.style.cursor = 'pointer';
                            cell.title = dateStr;
                            cell.onclick = () => updateStatsForDate(dateStr);
                        }
                    }

                    colDiv.appendChild(cell);
                    currentDay.setDate(currentDay.getDate() + 1);
                }
                heatmapContainer.appendChild(colDiv);
                col++;
            }
        }
        
        // Initialize with today's date
        const todayStr = new Date().toLocaleDateString('en-CA');
        updateStatsForDate(todayStr);
    };

    const updateStatsForDate = (dateStr) => {
        const textLabel = document.getElementById('selectedDateText');
        if (textLabel) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            textLabel.innerText = dateStr === todayStr ? 'Stats for Today' : `Stats for ${dateStr}`;
        }
        
        const dayData = currentDataMap[dateStr];
        if (dayData) {
            document.getElementById('statTasks').innerText = `${dayData.tasks_completed} / ${dayData.total_tasks}`;
            document.getElementById('statHours').innerText = dayData.hours.toFixed(1);
        } else {
            document.getElementById('statTasks').innerText = `0 / 0`;
            document.getElementById('statHours').innerText = `0.0`;
        }
    };

    // Read from preloaded script block if available
    const embedEl = document.getElementById('dashboard-data');
    let initialData = null;
    if (embedEl) {
        try {
            initialData = JSON.parse(embedEl.textContent);
        } catch (e) {
            console.error("Error parsing initial dashboard data for charts", e);
        }
    }

    if (initialData && initialData.analytics) {
        const res = initialData.analytics;
        if (res.status === 'success') {
            renderHeatmap(res.data, res.selected_year);
            renderYearSelector(res.years, res.selected_year);
        }
    } else {
        loadHeatmap();
    }
});
