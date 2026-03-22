document.addEventListener("DOMContentLoaded", () => {
  // Improved dropdown handling with event delegation (better performance, no memory leaks)
  document.addEventListener("click", (e) => {
    const clickedDropdown = e.target.closest("details.dropdown");

    // Close all open dropdowns if click is outside any dropdown
    if (!clickedDropdown) {
      document.querySelectorAll("details.dropdown[open]").forEach((dropdown) => {
        dropdown.removeAttribute("open");
      });
      return;
    }

    // If click is on a menu item inside dropdown, close it after small delay
    if (e.target.closest(".dropdown-content a, .dropdown-content label")) {
      setTimeout(() => {
        clickedDropdown.removeAttribute("open");
      }, 100); // Small delay for modals to open properly
    }
  });

  // Close dropdowns when modal opens
  document.querySelectorAll("input[type='checkbox'][id^='modal-']").forEach((modal) => {
    modal.addEventListener("change", () => {
      if (modal.checked) {
        document.querySelectorAll("details.dropdown[open]").forEach((dropdown) => {
          dropdown.removeAttribute("open");
        });
      }
    });
  });

  // Handle mobile logout button
  const mobileLogoutBtn = document.getElementById("mobile-logout");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", () => {
      // Trigger desktop logout button click
      const desktopLogoutBtn = document.getElementById("logout");
      if (desktopLogoutBtn) {
        desktopLogoutBtn.click();
      }

      // Close the drawer
      const menuDrawer = document.getElementById("menu-drawer");
      if (menuDrawer) {
        menuDrawer.checked = false;
      }
    });
  }
});