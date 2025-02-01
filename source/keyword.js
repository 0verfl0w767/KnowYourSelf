function fetchRelatedKeywords(keyword) {
  return fetch(`/api/related-keywords?keyword=${keyword}`)
    .then((response) => response.json())
    .then((data) => {
    const keywordsBody = document.getElementById("keywordsBody");
    keywordsBody.innerHTML = "";

    const sortedKeywords = Object.entries(data.keywords)
    // .filter(([key, count]) => count >= 2) // 빈도수 2 이상인 키워드만 필터링
    .sort((a, b) => b[1] - a[1]) // 빈도수로 내림차순 정렬
    .slice(0, 10); // 상위 9개만 선택

    // 정렬된 키워드 테이블에 추가
    sortedKeywords.forEach(([keyword, count]) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${keyword}</td><td>${count}</td>`;
      keywordsBody.appendChild(row);
    });
  })
    .catch((error) => {
    console.error("키워드를 가져오는 중 오류 발생:", error);
  });
}

const modal = document.getElementById("modal");
const closeModalButton = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");

wordsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("word")) {
    const keyword = event.target.textContent;

    fetchRelatedKeywords(keyword)
      .then((relatedKeywords) => {
      modalTitle.textContent = "TOP.10 " + keyword + " 키워드";
      modalDescription.innerHTML = "";
      modal.style.display = "flex";
    })
      .catch((error) => {
      console.error("Error fetching related keywords:", error);
      modalTitle.textContent = keyword;
      modalDescription.textContent = "키워드를 불러오는 중 오류가 발생했습니다.";
      modal.style.display = "flex";
    });
  }
});

closeModalButton.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.style.display = "none";
  }
});