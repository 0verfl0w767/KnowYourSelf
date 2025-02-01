const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const http = require("http");
require('dotenv').config();

const dataFilePath = "./techCounts.json";

const app = express();

app.use(bodyParser.json());

app.use("/", express.static(__dirname + "/source"));

app.get("/api/related-keywords", async (req, res) => {
  const keyword = req.query.keyword;

  if (!keyword) {
    return res.status(400).json({ error: "키워드를 제공해야 합니다." });
  }

  try {
    const data = await fs.promises.readFile(dataFilePath, "utf8");
    const keywordsData = JSON.parse(data);
    const relatedKeywords = keywordsData[keyword] || [];

    return res.json({ keywords: relatedKeywords });
  } catch (err) {
    console.error(err);

    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: "JSON 파싱 오류가 발생했습니다." });
    }

    return res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

app.get("/api/recommended-keywords", async (req, res) => {
  try {
    const keywords = await getDeveloperKeywords();
    res.status(200).json({ keywords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

async function getDeveloperKeywords() {
  const prompt = `
    개발자 직군, 역할을 10개 정도 키워드만 한국어로 콤마로 숫자없이 추출해주세요:

    추천 키워드:
    - 
    `;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const keywords = response.data.choices[0].message.content
      .split("\n")
      .filter(Boolean);
    return keywords;
  } catch (error) {
    console.error("Error generating keywords:", error);
    return [];
  }
}

app.post("/api/search", async (req, res) => {
  const { keywords } = req.body;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ message: "잘못된 값이 입력되었습니다." });
  }

  try {
    const results = await crawlJobSite(keywords.join(" "));
    const commonPoints = await analyzeCommonPoints(
      keywords,
      results.jobListings,
    );

    const techCounts = {};

    results.jobListings.forEach((job) => {
      const counts = extractTechCounts(job.extractedInfo.join("\n"));
      for (const [key, value] of Object.entries(counts)) {
        techCounts[key] = (techCounts[key] || 0) + value;
      }
    });

    keywords.forEach((keyword) => {
      const keywordLower = keyword.toLowerCase();
      saveTechCounts(keywordLower, techCounts);
    });

    res.status(200).json({
      results,
      commonPoints,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

async function crawlJobSite(keyword) {
  const url = `https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=${encodeURIComponent(keyword)}`;
  const jobListings = [];

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      },
      maxRedirects: 0,
    });

    const $ = cheerio.load(data);

    const promises = $(".item_recruit")
      .slice(0, 10)
      .map(async (index, element) => {
        const title = $(element).find(".job_tit").text().trim();
        const company = $(element).find(".corp_name").text().trim();
        const link = $(element).find(".job_tit a").attr("href");
        const rec_idx = new URL(
          link,
          "https://www.saramin.co.kr",
        ).searchParams.get("rec_idx");
        const extractedInfo = await crawlQualifications(rec_idx);

        return { title, company, link, rec_idx, extractedInfo };
      })
      .get();

    const results = await Promise.all(promises);

    jobListings.push(...results);

    return {
      keyword,
      jobListings,
    };
  } catch (error) {
    console.error(`Error crawling ${keyword}:`, error);
    return {
      keyword,
      jobListings: [],
    };
  }
}

async function crawlQualifications(rec_idx) {
  try {
    const { data } = await axios.get(
      `https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=${rec_idx}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
        maxRedirects: 0,
      },
    );

    const $ = cheerio.load(data);
    $("script, style").remove(); // 토큰 경량화
    const allText = $("body").text().trim(); // 토큰 경량화

    const prompt = `
        다음 텍스트에서 자격(지원) 요건과 우대 사항을 그대로 제대로 추출해 주세요:
        
        ${allText}
        
        주요 업무:
        - 

        자격(지원) 요건:
        - 

        우대 사항:
        - 
        `;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const extractedInfo = response.data.choices[0].message.content.split("\n");

    return extractedInfo;
  } catch (error) {
    console.error(`Error crawling qualifications for ${rec_idx}:`, error);
    return [];
  }
}

function extractTechCounts(qualifications) {
  const techCounts = {};

  const words = qualifications.match(
    /(?:[a-zA-Z]+(?:[\.\-\/][a-zA-Z]+)?)(?:\s+[a-zA-Z]+(?:[\.\-\/][a-zA-Z]+)?)*|(?:[a-zA-Z]+\s+[a-zA-Z]+)/g,
  );

  if (words) {
    words.forEach((word) => {
      const lowerWord = word.toLowerCase().trim();

      if (lowerWord.length > 1) {
        techCounts[lowerWord] = (techCounts[lowerWord] || 0) + 1;
      }
    });
  }

  return techCounts;
}

function saveTechCounts(keyword, counts) {
  let allCounts = {};

  if (fs.existsSync(dataFilePath)) {
    const rawData = fs.readFileSync(dataFilePath);
    allCounts = JSON.parse(rawData);
  }

  if (!allCounts[keyword]) {
    allCounts[keyword] = {};
  }

  for (const [tech, count] of Object.entries(counts)) {
    allCounts[keyword][tech] = (allCounts[keyword][tech] || 0) + count;
  }

  fs.writeFileSync(dataFilePath, JSON.stringify(allCounts, null, 2));
}

async function analyzeCommonPoints(keywords, jobListings) {
  const qualifications = jobListings
    .map((job) => job.extractedInfo.join("\n"))
    .join("\n");
  /*const prompt = `
    다음 자격 요건들을 기반으로 필요한 학습에 대해 제대로 설명해 주세요:
	정확히 무슨 프로그래밍 언어의 공통점이라던지, 정확한 기술 공통점이라던지 빈도수와 정확한 수치를 설명해 주세요.

    ${qualifications}


    필요한 학습:
    - 

	요구되는 언어:
    `;*/

  const prompt = `
      다음 자격 요건들을 기반으로 ${keywords} 직무로 들어가기 위해 필요한 학습과 진로방법을 한국어로 설명해 주세요:
      각 항목들에 대한 설명, 진로를 위한 노력방법, 추천 학습 계획, 추천 프로젝트를 자연스럽게 마크다운 방식으로 해주세요.

      ${qualifications}
      `;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing common points:", error);
    return "분석 중 오류가 발생했습니다.";
  }
}

app.get("*", (req, res) => {
  res.status(404).json({ statusCode: 404, message: "unknown request." });
});

http.createServer(app).listen(8888, "0.0.0.0");
