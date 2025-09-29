import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Data.css";

const Data = () => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
    });
    const [limit, setLimit] = useState(10);
    const [sortOrder, setSortOrder] = useState("latest");
    const [intersectionIdFilter, setIntersectionIdFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("last7days");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [availableIntersectionIds, setAvailableIntersectionIds] = useState(
        []
    );
    const [isLoadingIds, setIsLoadingIds] = useState(false);

    useEffect(() => {
        const fetchDistinctIntersectionIds = async () => {
            setIsLoadingIds(true);
            try {
                const res = await axios.get(
                    "http://localhost:5000/distinct-intersection-ids"
                );
                setAvailableIntersectionIds(res.data.intersectionIds || []);
            } catch (err) {
                console.error("Failed to load intersection IDs", err);
            } finally {
                setIsLoadingIds(false);
            }
        };
        fetchDistinctIntersectionIds();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: pagination.currentPage.toString(),
                    limit: limit.toString(),
                    sort: sortOrder,
                });

                if (intersectionIdFilter) {
                    params.append("intersectionId", intersectionIdFilter);
                }

                if (dateFilter && dateFilter !== "all") {
                    params.append("date", dateFilter);
                    if (
                        dateFilter === "custom" &&
                        customStartDate &&
                        customEndDate
                    ) {
                        params.append("start", customStartDate);
                        params.append("end", customEndDate);
                    }
                }

                const response = await axios.get(
                    `http://localhost:5000/historical-data?${params.toString()}`
                );

                setData(response.data.data || []);
                setPagination(
                    response.data.pagination || {
                        currentPage: 1,
                        totalPages: 1,
                        totalItems: 0,
                    }
                );
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(
                    err.response?.data?.error ||
                        err.message ||
                        "Failed to fetch data"
                );
                setData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [
        pagination.currentPage,
        limit,
        sortOrder,
        intersectionIdFilter,
        dateFilter,
        customStartDate,
        customEndDate,
    ]);

    const handleLimitChange = (e) => {
        setLimit(Number(e.target.value));
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const handleIntersectionFilterChange = (e) => {
        setIntersectionIdFilter(e.target.value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const handleDateFilterChange = (e) => {
        const newDateFilter = e.target.value;
        setDateFilter(newDateFilter);
        setPagination((p) => ({ ...p, currentPage: 1 }));

        if (newDateFilter !== "custom") {
            setCustomStartDate("");
            setCustomEndDate("");
        }
    };

    const handleCustomStartDateChange = (e) => {
        setCustomStartDate(e.target.value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const handleCustomEndDateChange = (e) => {
        setCustomEndDate(e.target.value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const handleSortOrderChange = (e) => {
        setSortOrder(e.target.value);
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination((p) => ({ ...p, currentPage: newPage }));
        }
    };

    const clearAllFilters = () => {
        setIntersectionIdFilter("");
        setDateFilter("last7days");
        setCustomStartDate("");
        setCustomEndDate("");
        setSortOrder("latest");
        setPagination((p) => ({ ...p, currentPage: 1 }));
    };

    const renderTimestamp = (createdAt) => {
        let dateString = null;
        if (
            typeof createdAt === "object" &&
            createdAt !== null &&
            createdAt.$date
        ) {
            dateString = createdAt.$date;
        } else if (typeof createdAt === "string") {
            dateString = createdAt;
        }

        if (!dateString) return "N/A";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Invalid Date";

        return date.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const isCustomDateValid = () => {
        if (dateFilter !== "custom") return true;
        if (!customStartDate || !customEndDate) return false;
        return new Date(customStartDate) <= new Date(customEndDate);
    };

    const renderContent = () => {
        if (isLoading)
            return (
                <div className="loading-message">
                    Loading historical data...
                </div>
            );
        if (error) return <div className="error-message">Error: {error}</div>;
        if (!data || data.length === 0) {
            return (
                <div className="no-data-message">
                    No historical data available for the selected filters.
                </div>
            );
        }

        return (
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp (IST)</th>
                            <th>Time (s)</th>
                            <th>Intersection ID</th>
                            <th>Total Vehicles</th>
                            <th>Halting Vehicles</th>
                            <th>Green Light Time (s)</th>
                            <th>Road Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.flatMap(
                            (record) =>
                                record.intersections?.map(
                                    (intersection, index) => (
                                        <tr
                                            key={`${record._id}-${intersection.id}-${index}`}
                                        >
                                            <td>
                                                {renderTimestamp(
                                                    record.createdAt
                                                )}
                                            </td>
                                            <td className="center-text">
                                                {record.time}
                                            </td>
                                            <td className="center-text">
                                                {intersection.id}
                                            </td>
                                            <td className="center-text">
                                                {intersection[
                                                    "total-vehicles"
                                                ] || 0}
                                            </td>
                                            <td className="center-text">
                                                {intersection[
                                                    "halting-vehicles"
                                                ] || 0}
                                            </td>
                                            <td className="center-text">
                                                {intersection.sides
                                                    ? Object.values(
                                                          intersection.sides
                                                      ).find(
                                                          (side) =>
                                                              side.light ===
                                                              "green"
                                                      )?.time ?? "—"
                                                    : "—"}
                                            </td>
                                            <td>
                                                {intersection.sides ? (
                                                    <ul className="road-details-list">
                                                        {Object.entries(
                                                            intersection.sides
                                                        )
                                                            .sort(
                                                                (
                                                                    [keyA],
                                                                    [keyB]
                                                                ) => {
                                                                    const numA =
                                                                        parseInt(
                                                                            keyA.split(
                                                                                "-"
                                                                            )[1]
                                                                        ) || 0;
                                                                    const numB =
                                                                        parseInt(
                                                                            keyB.split(
                                                                                "-"
                                                                            )[1]
                                                                        ) || 0;
                                                                    return (
                                                                        numA -
                                                                        numB
                                                                    );
                                                                }
                                                            )
                                                            .map(
                                                                ([
                                                                    sideId,
                                                                    sideData,
                                                                ]) => (
                                                                    <li
                                                                        key={
                                                                            sideId
                                                                        }
                                                                    >
                                                                        <strong>{`Road ${sideId.replace(
                                                                            "side-",
                                                                            ""
                                                                        )}:`}</strong>
                                                                        <span>
                                                                            {`${
                                                                                sideData[
                                                                                    "number-of-vehicles"
                                                                                ] ||
                                                                                0
                                                                            } Vehicles | `}
                                                                            <span className="capitalize-text">
                                                                                {sideData.light ||
                                                                                    "unknown"}
                                                                            </span>
                                                                            {` (${
                                                                                sideData.time ||
                                                                                0
                                                                            }s)`}
                                                                        </span>
                                                                    </li>
                                                                )
                                                            )}
                                                    </ul>
                                                ) : (
                                                    <span>No road data</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                ) || []
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="page-container">
            <h1 className="heading">Historical Data</h1>

            <div className="filters">
                <div className="filter-summary">
                    <span>
                        Showing {pagination.totalItems} records
                        {intersectionIdFilter &&
                            ` | Intersection: ${intersectionIdFilter}`}
                        {dateFilter !== "all" &&
                            ` | Date: ${
                                dateFilter === "custom"
                                    ? `${customStartDate} to ${customEndDate}`
                                    : dateFilter
                            }`}
                        {` | Sort: ${sortOrder}`}
                    </span>
                    <button
                        onClick={clearAllFilters}
                        className="clear-filters-btn"
                    >
                        Clear All Filters
                    </button>
                </div>

                <div className="controls-container">
                    <div className="control-group">
                        <label htmlFor="limit-select">Rows per page:</label>
                        <select
                            id="limit-select"
                            value={limit}
                            onChange={handleLimitChange}
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>

                    <div className="control-group">
                        <label htmlFor="intersection-filter">
                            Filter by Intersection ID:
                        </label>
                        <select
                            id="intersection-filter"
                            value={intersectionIdFilter}
                            onChange={handleIntersectionFilterChange}
                            disabled={isLoadingIds}
                        >
                            <option value="">All Intersections</option>
                            {availableIntersectionIds.map((id) => (
                                <option key={id} value={id}>
                                    {id}
                                </option>
                            ))}
                        </select>
                        {isLoadingIds && (
                            <span className="loading-text">Loading...</span>
                        )}
                    </div>

                    <div className="control-group">
                        <fieldset>
                            <legend>Date Filter:</legend>
                            <div className="radio-group">
                                <label>
                                    <input
                                        type="radio"
                                        name="date-filter"
                                        value="all"
                                        checked={dateFilter === "all"}
                                        onChange={handleDateFilterChange}
                                    />
                                    All Time
                                </label>

                                <label>
                                    <input
                                        type="radio"
                                        name="date-filter"
                                        value="last24hours"
                                        checked={dateFilter === "last24hours"}
                                        onChange={handleDateFilterChange}
                                    />
                                    Last 24 hours
                                </label>

                                <label>
                                    <input
                                        type="radio"
                                        name="date-filter"
                                        value="last7days"
                                        checked={dateFilter === "last7days"}
                                        onChange={handleDateFilterChange}
                                    />
                                    Last 7 days
                                </label>

                                <label>
                                    <input
                                        type="radio"
                                        name="date-filter"
                                        value="last30days"
                                        checked={dateFilter === "last30days"}
                                        onChange={handleDateFilterChange}
                                    />
                                    Last 30 days
                                </label>

                                <label>
                                    <input
                                        type="radio"
                                        name="date-filter"
                                        value="custom"
                                        checked={dateFilter === "custom"}
                                        onChange={handleDateFilterChange}
                                    />
                                    Custom Range
                                </label>
                            </div>
                        </fieldset>

                        {dateFilter === "custom" && (
                            <div className="custom-date-picker">
                                <div className="date-input-group">
                                    <label htmlFor="start-date">
                                        Start Date:
                                    </label>
                                    <input
                                        type="date"
                                        id="start-date"
                                        value={customStartDate}
                                        onChange={handleCustomStartDateChange}
                                        max={
                                            customEndDate ||
                                            new Date()
                                                .toISOString()
                                                .slice(0, 10)
                                        }
                                    />
                                </div>

                                <div className="date-input-group">
                                    <label htmlFor="end-date">End Date:</label>
                                    <input
                                        type="date"
                                        id="end-date"
                                        value={customEndDate}
                                        onChange={handleCustomEndDateChange}
                                        min={customStartDate || ""}
                                        max={new Date()
                                            .toISOString()
                                            .slice(0, 10)}
                                    />
                                </div>

                                {!isCustomDateValid() && (
                                    <div className="date-validation-error">
                                        Please select valid start and end dates.
                                        End date must be after start date.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="control-group">
                        <label htmlFor="sort-order">Sort Order:</label>
                        <select
                            id="sort-order"
                            value={sortOrder}
                            onChange={handleSortOrderChange}
                        >
                            <option value="latest">Latest first</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                    </div>
                </div>
            </div>
            {renderContent()}

            {!isLoading &&
                !error &&
                data &&
                data.length > 0 &&
                pagination.totalPages > 1 && (
                    <div className="pagination-container">
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={pagination.currentPage === 1}
                            className="pagination-btn"
                        >
                            &laquo;&laquo; First
                        </button>
                        <button
                            onClick={() =>
                                handlePageChange(pagination.currentPage - 1)
                            }
                            disabled={pagination.currentPage === 1}
                            className="pagination-btn"
                        >
                            &laquo; Previous
                        </button>
                        <span className="pagination-info">
                            Page {pagination.currentPage} of{" "}
                            {pagination.totalPages}({pagination.totalItems}{" "}
                            total records)
                        </span>
                        <button
                            onClick={() =>
                                handlePageChange(pagination.currentPage + 1)
                            }
                            disabled={
                                pagination.currentPage === pagination.totalPages
                            }
                            className="pagination-btn"
                        >
                            Next &raquo;
                        </button>
                        <button
                            onClick={() =>
                                handlePageChange(pagination.totalPages)
                            }
                            disabled={
                                pagination.currentPage === pagination.totalPages
                            }
                            className="pagination-btn"
                        >
                            Last &raquo;&raquo;
                        </button>
                    </div>
                )}
        </div>
    );
};

export default Data;
