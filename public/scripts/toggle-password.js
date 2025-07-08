export function initTogglePassword() {
  document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const icon = button.querySelector("img");

      if (input.type === "password") {
        input.type = "text";
        icon.src = "/public/images/visible-icon.png"; // swap to "visible" icon
      } else {
        input.type = "password";
        icon.src = "/public/images/hidden-icon.png"; // swap back
      }
    });
  });
}