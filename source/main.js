const inputField = document.getElementById("searchInput");
const wordsContainer = document.getElementById("wordsContainer");
const searchButton = document.getElementById("searchButton");
const loadingMessage = document.getElementById("loadingMessage");
const resultsContainer = document.getElementById("resultsContainer");
const commonPointsContainer = document.getElementById("commonPointsContainer");
const commonPointsContent = document.getElementById("commonPointsContent");
const recommendedKeywordsContainer = document.getElementById(
  "recommendedKeywords",
);

inputField.addEventListener("input", () => {
  const input = inputField.value.trim();
  wordsContainer.innerHTML = "";

  const words = input.split(" ").filter((word) => word !== "");

  words.forEach((word) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = word;
    wordsContainer.appendChild(span);
  });

  searchButton.style.display = words.length >= 1 ? "inline-block" : "none";
});

searchButton.addEventListener("click", () => {
  const input = inputField.value.trim();
  const words = input.split(" ").filter((word) => word !== "");

  if (words.length >= 1) {
    loadingMessage.style.display = "block";
    resultsContainer.innerHTML = "";
    commonPointsContent.innerHTML = "";
    commonPointsContainer.style.display = "none";

    fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keywords: words }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        data.results.jobListings.forEach((job, index) => {
          setTimeout(() => {
            const jobElement = document.createElement("div");
            jobElement.className = "job-listing";
            jobElement.innerHTML = `
<h3>${job.title}</h3>
<h4>${job.company}</h4>
${job.extractedInfo.map((line) => `<p>${line}</p>`).join("")}
<a href="https://saramin.co.kr${job.link}" target="_blank" class="link">공고 확인하기</a>
`;
            resultsContainer.appendChild(jobElement);
          }, index * 300);
        });
        const commonPointsElement = document.createElement("div");
        const markdownContent = data.commonPoints;
        commonPointsElement.innerHTML = marked.parse(markdownContent);
        commonPointsContent.appendChild(commonPointsElement);

        commonPointsContainer.style.display = "block";
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        loadingMessage.style.display = "none";
        commonPointsContainer.style.display = "block";
      });
  }
});

function fetchRecommendedKeywords() {
  loadingMessage.style.display = "block";
  fetch("/api/recommended-keywords")
    .then((response) => response.json())
    .then((data) => {
      recommendedKeywordsContainer.innerHTML = `
<div id="tips">추천 키워드:</div>
<p>${data.keywords.join(", ")}</p>
`;
    })
    .catch((error) => console.error("Error fetching keywords:", error))
    .finally(() => {
      loadingMessage.style.display = "none";
    });
}

window.onload = fetchRecommendedKeywords;

const keywords = [
  "프로그래밍",
  "웹 개발",
  "데이터 과학",
  "인공지능",
  "클라우드 컴퓨팅",
  "모바일 개발",
  "프론트엔드 개발",
  "백엔드 개발",
  "풀스택 개발",
  "UX/UI 디자인",
  "소프트웨어 엔지니어링",
  "머신러닝",
  "빅데이터",
  "DevOps",
  "API 개발",
  "데이터베이스 관리",
  "사이버 보안",
  "IoT (사물인터넷)",
  "블록체인 개발",
  "게임 개발",
  "애플리케이션 보안",
  "네트워크 관리",
  "웹 퍼포먼스 최적화",
  "반응형 디자인",
  "웹 애플리케이션",
  "자바스크립트",
  "파이썬",
  "자바",
  "루비",
  "PHP",
  "C#",
  "TypeScript",
  "Angular",
  "React",
  "Vue.js",
  "Node.js",
  "MongoDB",
  "SQL",
  "Git",
  "TDD (테스트 주도 개발)",
];

function getRandomKeyword() {
  return keywords[Math.floor(Math.random() * keywords.length)];
}

function updateAds() {
  const ads1 = Array.from({ length: 10 }, () => "#" + getRandomKeyword()).join(
    " ",
  );
  const ads2 = Array.from({ length: 10 }, () => "#" + getRandomKeyword()).join(
    " ",
  );

  document.getElementById("keywordAd1").textContent = ads1;
  document.getElementById("keywordAd2").textContent = ads2;
}

setInterval(updateAds, 1000 * 30);
updateAds();
